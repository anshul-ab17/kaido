import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import authPlugin from './plugins/auth.js';
import redisPlugin from './plugins/redis.js';
import wsPlugin from './plugins/websocket.js';
import { authRoutes } from './routes/auth.js';
import { marketRoutes } from './routes/markets.js';
import { tradeRoutes } from './routes/trade.js';
import { portfolioRoutes } from './routes/portfolio.js';
import { prisma } from './lib/prisma.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: typeof prisma;
  }
}

const app = Fastify({
  logger: { level: config.NODE_ENV === 'development' ? 'info' : 'warn' },
});

await app.register(helmet);
await app.register(cors, {
  origin: config.NODE_ENV === 'development' ? true : ['https://kaido.app'],
});
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
await app.register(jwt, { secret: config.JWT_SECRET });
await app.register(websocket);
await app.register(redisPlugin);
await app.register(authPlugin);
await app.register(wsPlugin);

app.decorate('prisma', prisma);

await app.register(authRoutes, { prefix: '/auth' });
await app.register(marketRoutes);
await app.register(tradeRoutes);
await app.register(portfolioRoutes);

app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  console.log(`API running on http://localhost:${config.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
