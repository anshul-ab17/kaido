import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { WsMessage } from '@repo/types';
import { createNatsClient, TickProducer, TickConsumer } from '@repo/messaging';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    broadcast: (message: WsMessage) => void;
  }
}

const wsPlugin: FastifyPluginAsync = async (fastify) => {
  const clients = new Set<import('@fastify/websocket').WebSocket>();

  fastify.decorate('broadcast', (message: WsMessage) => {
    const payload = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === 1) client.send(payload);
    }
  });

  // Two NATS connections: one for publishing ticks, one for consuming them
  const producerNc = await createNatsClient(config.NATS_URL);
  const consumerNc = await createNatsClient(config.NATS_URL);

  const tickProducer = new TickProducer(producerNc);

  // Consumer fans out NATS tick messages to all connected WebSocket clients
  const tickConsumer = new TickConsumer(consumerNc, (symbol, price, timestamp) => {
    const msg: WsMessage = {
      type: 'data',
      payload: { channel: 'ticker', symbol, data: { symbol, price, timestamp }, timestamp },
    };
    fastify.broadcast(msg);
  });
  tickConsumer.start();

  // WebSocket endpoint
  fastify.get('/ws', { websocket: true }, (socket) => {
    clients.add(socket);
    socket.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsMessage;
        if (msg.type === 'ping') socket.send(JSON.stringify({ type: 'pong' }));
      } catch {
        socket.send(JSON.stringify({ type: 'error', error: 'Invalid message' }));
      }
    });
    socket.on('close', () => clients.delete(socket));
  });

  // Fetch live Pyth prices every 500ms and publish to NATS
  const tickInterval = setInterval(() => {
    void (async () => {
      try {
        const prices = await fastify.sdk.pyth.getPrices();
        const now = Date.now();
        for (const [symbol, price] of Object.entries(prices)) {
          tickProducer.publish(symbol, price, now);
        }
      } catch {
        // Pyth temporarily unreachable — skip this interval, next will retry
      }
    })();
  }, 500);

  fastify.addHook('onClose', async () => {
    clearInterval(tickInterval);
    tickConsumer.stop();
    await producerNc.drain();
    await consumerNc.drain();
  });
};

export default fp(wsPlugin, { name: 'websocket' });
