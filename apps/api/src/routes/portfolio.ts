import type { FastifyPluginAsync } from 'fastify';

export const portfolioRoutes: FastifyPluginAsync = async (fastify) => {

  function requireWallet(wallet: string | undefined): string {
    if (!wallet) throw { statusCode: 400, message: 'wallet query param required' };
    return wallet;
  }

  // GET /portfolio?wallet=xxx — live token balances from Helius DAS
  fastify.get<{ Querystring: { wallet?: string } }>('/portfolio', async (request, reply) => {
    const wallet   = requireWallet(request.query.wallet);
    const holdings = await fastify.sdk.helius.getWalletAssets(wallet);

    const totalValue = holdings.reduce((s, h) => s + h.usdValue, 0);
    const pnl24h     = holdings.reduce((s, h) => s + (h.usdValue * (h.change24h ?? 0)) / 100, 0);

    return reply.send({
      holdings,
      totalValue:      +totalValue.toFixed(2),
      pnl24h:          +pnl24h.toFixed(2),
      pnl24hPct:       totalValue > 0 ? +((pnl24h / totalValue) * 100).toFixed(2) : 0,
      realizedPnl:     0,
      unrealizedPnl:   0,
      marginUsed:      0,
      availableMargin: +totalValue.toFixed(2),
      accountHealth:   100,
      avgLeverage:     1,
    });
  });

  // GET /portfolio/performance?wallet=xxx&range=7d|30d|all
  fastify.get<{ Querystring: { wallet?: string; range?: string } }>(
    '/portfolio/performance',
    async (request, reply) => {
      const wallet = requireWallet(request.query.wallet);
      const range  = request.query.range ?? '30d';
      const days   = range === '7d' ? 7 : range === 'all' ? 90 : 30;
      const since  = new Date(Date.now() - days * 86_400_000);

      const identity = await fastify.prisma.authIdentity.findFirst({
        where: { type: 'wallet', address: wallet },
      });
      if (!identity) return reply.send({ performance: [], range });

      const trades = await fastify.prisma.trade.findMany({
        where:   { userId: identity.userId, createdAt: { gte: since } },
        orderBy: { createdAt: 'asc' },
      });

      let cumPnl = 0;
      const performance = trades.map((t) => {
        cumPnl += t.side === 'long' ? t.price * t.size * 0.001 : -(t.fee);
        return { time: Math.floor(t.createdAt.getTime() / 1000), value: +cumPnl.toFixed(2) };
      });

      return reply.send({ performance, range });
    },
  );

  // GET /positions?wallet=xxx
  fastify.get<{ Querystring: { wallet?: string } }>('/positions', async (request, reply) => {
    const wallet   = requireWallet(request.query.wallet);
    const identity = await fastify.prisma.authIdentity.findFirst({
      where: { type: 'wallet', address: wallet },
    });
    if (!identity) return reply.send({ positions: [] });

    const orders = await fastify.prisma.order.findMany({
      where:   { userId: identity.userId, status: 'open' },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ positions: orders });
  });

  // GET /orders?wallet=xxx
  fastify.get<{ Querystring: { wallet?: string } }>('/orders', async (request, reply) => {
    const wallet   = requireWallet(request.query.wallet);
    const identity = await fastify.prisma.authIdentity.findFirst({
      where: { type: 'wallet', address: wallet },
    });
    if (!identity) return reply.send({ orders: [] });

    const orders = await fastify.prisma.order.findMany({
      where:   { userId: identity.userId },
      orderBy: { createdAt: 'desc' },
      take:    50,
    });
    return reply.send({ orders });
  });

  // GET /trades?wallet=xxx
  fastify.get<{ Querystring: { wallet?: string } }>('/trades', async (request, reply) => {
    const wallet   = requireWallet(request.query.wallet);
    const identity = await fastify.prisma.authIdentity.findFirst({
      where: { type: 'wallet', address: wallet },
    });
    if (!identity) return reply.send({ trades: [] });

    const trades = await fastify.prisma.trade.findMany({
      where:   { userId: identity.userId },
      orderBy: { createdAt: 'desc' },
      take:    100,
    });
    return reply.send({ trades });
  });

  fastify.get('/funding', async (_req, reply) => reply.send({ payments: [] }));
  fastify.get('/deposits', async (_req, reply) => reply.send({ deposits: [] }));

  // POST /deposits/initiate
  fastify.post<{ Body: { amount: number; currency: string; method: 'crypto' | 'card'; wallet: string } }>(
    '/deposits/initiate',
    async (request, reply) => {
      const { amount, currency, method, wallet } = request.body;
      if (!wallet) return reply.code(400).send({ error: 'wallet required' });

      if (method === 'card') {
        return reply.send({
          id:          `dep_${Date.now()}`,
          method:      'card',
          checkoutUrl: `https://checkout.dodopayments.com/session/kaido_${Date.now()}`,
          amount, currency,
          expiresAt:   Date.now() + 30 * 60 * 1000,
        });
      }

      return reply.send({
        id:             `dep_${Date.now()}`,
        method:         'crypto',
        depositAddress: wallet,
        network:        'Solana',
        currency, amount,
        memo:           `DEP-${Date.now().toString(36).toUpperCase()}`,
      });
    },
  );
};
