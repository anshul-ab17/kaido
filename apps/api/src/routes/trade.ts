import type { FastifyPluginAsync } from 'fastify';
import type { RouteRequest } from '@repo/types';
import { config } from '../config.js';

export const tradeRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /trade/quote — Jupiter → routing engine → 503
  fastify.post<{ Body: RouteRequest }>('/trade/quote', async (request, reply) => {
    const { inputToken, outputToken, inputAmount } = request.body;

    // 1. Try Jupiter
    try {
      const result = await fastify.sdk.jupiter.quote({ inputToken, outputToken, inputAmount });
      return reply.send({
        steps: [{ venue: 'jupiter', inputToken, outputToken, inputAmount, outputAmount: result.outputAmount, priceImpact: result.priceImpact, fee: inputAmount * 0.0005 }],
        inputAmount, outputAmount: result.outputAmount,
        priceImpact:      result.priceImpact,
        totalFee:         inputAmount * 0.0005,
        confidenceScore:  0.992,
        aiExplanation:    `Routed via Jupiter across ${(result.routePlan as unknown[]).length} venues.`,
        estimatedSavings: result.outputAmount * 0.001,
        executionTimeMs:  15,
        source:           'jupiter',
      });
    } catch { /* fall to engine */ }

    // 2. Try routing engine
    try {
      const res = await fetch(`${config.ROUTING_ENGINE_URL}/score-route`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(request.body),
        signal:  AbortSignal.timeout(2000),
      });
      if (!res.ok) throw new Error(`Engine ${res.status}`);
      return reply.send(await res.json());
    } catch { /* fall through */ }

    return reply.code(503).send({ error: 'Quote unavailable: Jupiter and routing engine both unreachable' });
  });

  // POST /trade/build-tx — Jupiter swap
  fastify.post<{ Body: { routeResult: unknown; walletAddress: string } }>(
    '/trade/build-tx',
    async (request, reply) => {
      const { walletAddress, routeResult } = request.body;
      if (!walletAddress) return reply.code(400).send({ error: 'walletAddress required' });

      const qr = routeResult as { inputToken?: string; outputToken?: string; inputAmount?: number };
      if (!qr.inputToken || !qr.outputToken || !qr.inputAmount) {
        return reply.code(400).send({ error: 'routeResult must include inputToken, outputToken, inputAmount' });
      }

      try {
        const quote = await fastify.sdk.jupiter.quote({
          inputToken: qr.inputToken, outputToken: qr.outputToken, inputAmount: qr.inputAmount,
        });
        const tx = await fastify.sdk.jupiter.buildSwap(quote, walletAddress);
        return reply.send({ ...tx, source: 'jupiter', expiresAt: Date.now() + 30_000 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.code(503).send({ error: `Transaction build failed: ${msg}` });
      }
    },
  );

  // POST /trade/confirm — verify + index to DB
  fastify.post<{ Body: { signature: string; market: string; walletAddress: string; size?: number; price?: number; side?: string } }>(
    '/trade/confirm',
    async (request, reply) => {
      const { signature, market, walletAddress, size = 0, price = 0, side = 'long' } = request.body;
      if (!signature) return reply.code(400).send({ error: 'signature required' });

      let onChainOk = false;
      try {
        onChainOk = await fastify.sdk.solana.isTransactionConfirmed(signature);
      } catch {
        return reply.code(503).send({ error: 'Cannot verify transaction: Solana RPC unreachable' });
      }
      if (!onChainOk) {
        return reply.code(400).send({ error: 'Transaction not found or not confirmed on-chain' });
      }

      const identity = await fastify.prisma.authIdentity.findFirst({
        where: { type: 'wallet', address: walletAddress },
      });
      if (!identity) return reply.code(401).send({ error: 'Wallet not authenticated' });

      const dbMarket = await fastify.prisma.market.findUnique({ where: { symbol: market } });
      if (!dbMarket) return reply.code(404).send({ error: 'Market not found' });

      const trade = await fastify.prisma.trade.upsert({
        where:  { signature },
        update: {},
        create: { signature, userId: identity.userId, marketId: dbMarket.id, side, price, size, fee: size * price * 0.0005 },
      });

      return reply.send({ confirmed: true, signature, confirmedAt: Date.now(), tradeId: trade.id });
    },
  );

  // POST /trade/orders/tpsl — persisted to DB
  fastify.post<{
    Body: { market: string; side: 'long' | 'short'; size: number; entryPrice: number; tpPrice?: number; slPrice?: number; leverage?: number; walletAddress: string };
  }>('/trade/orders/tpsl', async (request, reply) => {
    const { market, side, size, entryPrice, tpPrice, slPrice, leverage = 1, walletAddress } = request.body;
    if (!tpPrice && !slPrice) return reply.code(400).send({ error: 'tpPrice or slPrice required' });
    if (size <= 0) return reply.code(400).send({ error: 'size must be positive' });

    const order = await fastify.prisma.tpSlOrder.create({
      data: {
        id:         `tpsl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        wallet:     walletAddress,
        market, side, size, entryPrice,
        tpPrice:    tpPrice ?? null,
        slPrice:    slPrice ?? null,
        leverage,
        status:     'active',
      },
    });
    return reply.code(201).send({ order });
  });

  // GET /trade/orders/tpsl?wallet=xxx
  fastify.get<{ Querystring: { wallet?: string } }>('/trade/orders/tpsl', async (request, reply) => {
    const where = request.query.wallet ? { wallet: request.query.wallet } : {};
    const orders = await fastify.prisma.tpSlOrder.findMany({ where, orderBy: { createdAt: 'desc' } });
    return reply.send({ orders });
  });

  // DELETE /trade/orders/tpsl/:id
  fastify.delete<{ Params: { id: string } }>('/trade/orders/tpsl/:id', async (request, reply) => {
    const order = await fastify.prisma.tpSlOrder.findUnique({ where: { id: request.params.id } });
    if (!order) return reply.code(404).send({ error: 'Order not found' });
    const updated = await fastify.prisma.tpSlOrder.update({
      where: { id: order.id },
      data:  { status: 'cancelled' },
    });
    return reply.send({ success: true, order: updated });
  });
};
