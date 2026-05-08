import type { FastifyPluginAsync } from 'fastify';

export const portfolioRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/portfolio', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { walletAddress } = request.user as { walletAddress: string };
    return reply.send({
      walletAddress,
      balances: [
        { symbol: 'SOL', amount: 12.5, usdValue: 1815.0 },
        { symbol: 'USDC', amount: 1450.0, usdValue: 1450.0 },
      ],
      totalUsdValue: 3265.0,
    });
  });

  fastify.get('/positions', { preHandler: [fastify.authenticate] }, async (_req, reply) => {
    return reply.send({ positions: [] });
  });

  fastify.get('/orders', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const orders = await fastify.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return reply.send({ orders });
  });
};
