import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { WsMessage } from '@repo/types';

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

  // Mock price tick every 500ms
  setInterval(() => {
    fastify.broadcast({
      type: 'data',
      payload: {
        channel: 'ticker',
        symbol: 'SOL-PERP',
        data: { price: 145 + (Math.random() - 0.5) * 2, timestamp: Date.now() },
        timestamp: Date.now(),
      },
    });
  }, 500);
};

export default fp(wsPlugin, { name: 'websocket' });
