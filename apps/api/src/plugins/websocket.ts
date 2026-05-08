import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { WsMessage } from '@repo/types';
import { createCache, StreamProducer, StreamConsumer } from '@repo/cache';

const TICK_STREAM = 'kaido:ticks';

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

  // Dedicated connections for stream producer and consumer
  const producerClient = createCache(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
  const consumerClient = createCache(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
  await producerClient.connect();
  await consumerClient.connect();

  const producer = new StreamProducer(producerClient);

  // Consumer fans out stream entries to all WebSocket clients
  const consumer = new StreamConsumer(consumerClient, TICK_STREAM, (entry) => {
    if (!entry['data']) return;
    const tick = JSON.parse(entry['data']) as { channel: string; symbol: string; price: number; timestamp: number };
    const message: WsMessage = {
      type: 'data',
      payload: { channel: 'ticker', symbol: tick.symbol, data: tick, timestamp: tick.timestamp },
    };
    fastify.broadcast(message);
  });
  consumer.start();

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

  // Mock tick producer — publishes to stream every 500ms
  const tickInterval = setInterval(() => {
    const now = Date.now();
    void producer.publish(TICK_STREAM, {
      data: JSON.stringify({ channel: 'ticker', symbol: 'SOL-PERP', price: String(145 + (Math.random() - 0.5) * 2), timestamp: String(now) }),
      timestamp: String(now),
    });
  }, 500);

  fastify.addHook('onClose', async () => {
    clearInterval(tickInterval);
    consumer.stop();
    await producerClient.quit();
    await consumerClient.quit();
  });
};

export default fp(wsPlugin, { name: 'websocket' });
