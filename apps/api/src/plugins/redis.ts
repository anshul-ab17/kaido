import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { redis } from '../lib/redis.js';

declare module 'fastify' {
  interface FastifyInstance {
    redis: typeof redis;
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  await redis.connect();
  fastify.decorate('redis', redis);
  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
};

export default fp(redisPlugin, { name: 'redis' });
