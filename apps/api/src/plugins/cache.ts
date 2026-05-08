import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { createCache, type Redis } from '@repo/cache';

declare module 'fastify' {
  interface FastifyInstance {
    cache: Redis;
  }
}

const cachePlugin: FastifyPluginAsync = async (fastify) => {
  const client = createCache(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
  await client.connect();
  fastify.decorate('cache', client);
  fastify.addHook('onClose', async () => {
    await client.quit();
  });
};

export default fp(cachePlugin, { name: 'cache' });
