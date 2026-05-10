import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { WsMessage } from '@repo/types';
import { TickProducer, TickConsumer } from '@repo/messaging';
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

  // Connect producer and consumer to NATS (gracefully skip if NATS unavailable)
  const tickProducer = new TickProducer();
  const tickConsumer = new TickConsumer();
  let natsAvailable = false;

  try {
    await tickProducer.connect(config.NATS_URL);
    await tickConsumer.connect(config.NATS_URL);
    natsAvailable = true;

    // Consumer fans out NATS tick messages to all connected WebSocket clients
    tickConsumer.onTick((symbol, data) => {
      const tickData = data as { price: number; timestamp: number };
      const msg: WsMessage = {
        type: 'data',
        payload: {
          channel: 'ticker',
          symbol,
          data: { symbol, price: tickData.price, timestamp: tickData.timestamp },
          timestamp: tickData.timestamp,
        },
      };
      fastify.broadcast(msg);
    });
  } catch (err) {
    fastify.log.warn({ err }, 'NATS unavailable — WebSocket tick relay disabled');
  }

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
    if (!natsAvailable) return;
    void (async () => {
      try {
        const prices = await fastify.sdk.pyth.getPrices();
        const now = Date.now();
        for (const [symbol, price] of Object.entries(prices)) {
          tickProducer.publish(symbol, { price, timestamp: now });
        }
      } catch {
        // Pyth temporarily unreachable — skip this interval, next will retry
      }
    })();
  }, 500);

  fastify.addHook('onClose', async () => {
    clearInterval(tickInterval);
    if (natsAvailable) {
      await tickProducer.close();
      await tickConsumer.close();
    }
  });
};

export default fp(wsPlugin, { name: 'websocket' });
