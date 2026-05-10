import type { FastifyPluginAsync } from 'fastify';

export const insightRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /insights/stats — live Solana RPC + DeFiLlama TVL
  fastify.get('/insights/stats', async (_req, reply) => {
    const [slot, tps, tvl] = await Promise.all([
      fastify.sdk.solana.getSlot().catch(() => 0),
      fastify.sdk.solana.getTps().catch(() => 0),
      fastify.sdk.defillama.getSolanaTvl().catch(() => 0),
    ]);

    return reply.send({
      stats: {
        totalVolume24h:  0,
        totalTvl:        tvl,
        activeTraders:   0,
        transactions24h: tps * 86400,
        solanaFee:       0.000025,
        solanaSlot:      slot,
        solanaTps:       tps,
      },
    });
  });

  // GET /insights/whales — large recent transactions via Helius
  fastify.get<{ Querystring: { limit?: string } }>(
    '/insights/whales',
    async (request, reply) => {
      const limit  = Math.min(parseInt(request.query.limit ?? '20', 10), 30);
      const whales = await fastify.sdk.helius.getLargeTransactions(50_000, limit);
      return reply.send({ whales, updatedAt: new Date().toISOString() });
    },
  );

  // GET /insights/liquidity — DeFiLlama Solana pools
  fastify.get('/insights/liquidity', async (_req, reply) => {
    const pools = await fastify.sdk.defillama.getSolanaPools(20);
    return reply.send({ pools, updatedAt: new Date().toISOString() });
  });

  // GET /insights/funding — Drift Protocol funding rates
  fastify.get('/insights/funding', async (_req, reply) => {
    const rates = await fastify.sdk.drift.getFundingRates();
    return reply.send({ rates, updatedAt: new Date().toISOString() });
  });
};
