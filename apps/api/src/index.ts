import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import authPlugin from './plugins/auth.js';
import cachePlugin from './plugins/cache.js';
import wsPlugin from './plugins/websocket.js';
import { authRoutes } from './routes/auth.js';
import { marketRoutes } from './routes/markets.js';
import { tradeRoutes } from './routes/trade.js';
import { portfolioRoutes } from './routes/portfolio.js';
import { eventRoutes } from './routes/events.js';
import { insightRoutes } from './routes/insights.js';
import { aiRoutes } from './routes/ai.js';
import { prisma } from '@repo/db';
import { createLogPoseSDK, type LogPoseSDK } from '@repo/sdk';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: typeof prisma;
    sdk:    LogPoseSDK;
  }
}

const ALLOWED_ORIGINS =
  config.NODE_ENV === 'development'
    ? true
    : [
        'https://kaido.app',
        'https://www.kaido.app',
        'https://staging.kaido.app',
        ...(process.env['EXTRA_ORIGINS'] ? process.env['EXTRA_ORIGINS'].split(',') : []),
      ];

const app = Fastify({
  logger: { level: config.NODE_ENV === 'development' ? 'info' : 'warn' },
});

await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'wss:', 'https:'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
});

await app.register(cors, {
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
});

// Global rate limit — generous for market data reads
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

await app.register(jwt, { secret: config.JWT_SECRET });
await app.register(websocket);
await app.register(cachePlugin);
await app.register(authPlugin);
await app.register(wsPlugin);

app.decorate('prisma', prisma);

const sdk = createLogPoseSDK({
  heliusApiKey:  config.HELIUS_API_KEY,
  birdeyeApiKey: config.BIRDEYE_API_KEY,
});
app.decorate('sdk', sdk);

// Auth routes get stricter rate limits to prevent brute force / nonce spam
await app.register(authRoutes, {
  prefix: '/auth',
  // @ts-expect-error fastify-plugin config passthrough
  rateLimit: { max: 20, timeWindow: '1 minute' },
});

await app.register(marketRoutes);
await app.register(tradeRoutes);
await app.register(portfolioRoutes);
await app.register(eventRoutes);
await app.register(insightRoutes);
await app.register(aiRoutes);

// AI chat has its own limit to control Anthropic API costs
app.addHook('onRequest', async (request, reply) => {
  if (request.url === '/ai/chat' && request.method === 'POST') {
    const ip = request.ip;
    const key = `ai-chat:${ip}`;
    const count = parseInt((await app.cache?.get(key)) ?? '0', 10);
    if (count >= 30) {
      return reply.code(429).send({ error: 'AI chat rate limit: 30 requests/minute' });
    }
    await app.cache?.setex(key, 60, String(count + 1));
  }
});

app.get('/health', async () => ({ status: 'ok', timestamp: Date.now(), env: config.NODE_ENV }));

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  console.log(`API running on http://localhost:${config.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
