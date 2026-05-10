import type { FastifyPluginAsync } from 'fastify';

export const insightRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /insights/stats — { totalVolume24h, totalTvl, activeTraders, tps, slot }
  fastify.get('/insights/stats', async (_req, reply) => {
    const [slot, tps, tvl] = await Promise.all([
      fastify.sdk.solana.getSlot().catch(() => 0),
      fastify.sdk.solana.getTps().catch(() => 0),
      fastify.sdk.defillama.getSolanaTvl().catch(() => 0),
    ]);
    return reply.send({ totalVolume24h: 0, totalTvl: tvl, activeTraders: 0, tps, slot });
  });

  // GET /insights/whales — WhaleEvent[] bare array
  fastify.get<{ Querystring: { limit?: string } }>(
    '/insights/whales',
    async (request, reply) => {
      const limit  = Math.min(parseInt(request.query.limit ?? '20', 10), 30);
      const txs    = await fastify.sdk.helius.getLargeTransactions(50_000, limit).catch(() => []);
      // Map 'swap' → 'transfer' so it matches the frontend WhaleEvent type
      const whales = txs.map((t) => ({
        ...t,
        type: (t.type === 'swap' ? 'transfer' : t.type) as 'buy' | 'sell' | 'transfer' | 'liquidation',
      }));
      return reply.send(whales);
    },
  );

  // GET /insights/liquidity — LiquidityPool[] bare array ({ name, venue, tvl, apy, volume24h, fee })
  fastify.get('/insights/liquidity', async (_req, reply) => {
    const pools = await fastify.sdk.defillama.getSolanaPools(20).catch(() => []);
    return reply.send(pools.map((p) => ({ name: p.pair, venue: p.venue, tvl: p.tvl, apy: p.apy, volume24h: p.volume24h, fee: p.fee })));
  });

  // GET /insights/funding — FundingRate[] bare array ({ symbol, rate, annualized, openInterest, direction })
  fastify.get('/insights/funding', async (_req, reply) => {
    const rates = await fastify.sdk.drift.getFundingRates().catch(() => []);
    return reply.send(rates.map((r) => ({
      symbol:       r.market,
      rate:         r.rate,
      annualized:   r.annualized,
      openInterest: r.openInterest,
      direction:    (r.direction === 'long' ? 'longs-pay' : 'shorts-pay') as 'longs-pay' | 'shorts-pay',
    })));
  });
};
