import type { FastifyPluginAsync } from 'fastify';

// ── LMSR math ────────────────────────────────────────────────────────────────

const LMSR_B = 1000;

function lmsrPrices(qYes: number, qNo: number): { yes: number; no: number } {
  const eY = Math.exp(qYes / LMSR_B);
  const eN = Math.exp(qNo  / LMSR_B);
  const sum = eY + eN;
  return { yes: eY / sum, no: eN / sum };
}

function lmsrCost(qYes: number, qNo: number): number {
  return LMSR_B * Math.log(Math.exp(qYes / LMSR_B) + Math.exp(qNo / LMSR_B));
}

function lmsrBuy(
  qYes: number, qNo: number, side: 'yes' | 'no', amount: number,
): { shares: number; newQYes: number; newQNo: number } {
  const before = lmsrCost(qYes, qNo);
  let lo = 0, hi = amount * 10;
  for (let i = 0; i < 64; i++) {
    const mid   = (lo + hi) / 2;
    const after = lmsrCost(
      side === 'yes' ? qYes + mid : qYes,
      side === 'no'  ? qNo  + mid : qNo,
    );
    if (after - before < amount) lo = mid; else hi = mid;
  }
  const shares = (lo + hi) / 2;
  return {
    shares,
    newQYes: side === 'yes' ? qYes + shares : qYes,
    newQNo:  side === 'no'  ? qNo  + shares : qNo,
  };
}

// ── Subtopic / Topic shapes returned to frontend ──────────────────────────────

export interface EventSubtopic {
  id:            string;
  question:      string;
  yesPrice:      number;
  noPrice:       number;
  volume:        number;
  endDate:       string;
  source:        'polymarket';
  url?:          string;
  conditionId?:  string;
  yesTokenId?:   string;
}

export interface EventTopic {
  id:        string;
  title:     string;
  category:  string;
  source:    'polymarket';
  volume:    number;
  liquidity: number;
  endDate:   string;
  subtopics: EventSubtopic[];
}

// ── Routes ────────────────────────────────────────────────────────────────────

export const eventRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /events/topics — Polymarket (Gamma API)
  fastify.get<{ Querystring: { limit?: string; category?: string; q?: string } }>(
    '/events/topics',
    async (request, reply) => {
      const limit    = Math.min(parseInt(request.query.limit ?? '50', 10), 100);
      const category = request.query.category;
      const q        = request.query.q?.trim();

      let topics: EventTopic[] = [];
      try {
        const raw = q
          ? await fastify.sdk.polymarket.searchEventTopics(q, limit)
          : await fastify.sdk.polymarket.getEventTopics(limit);
        topics = raw as EventTopic[];
      } catch {
        topics = [];
      }

      if (category && category !== 'All') {
        topics = topics.filter((t) => t.category === category);
      }

      const categories = ['All', ...new Set(topics.map((t) => t.category))].sort();

      return reply.send({ topics, categories, updatedAt: new Date().toISOString() });
    },
  );

  // GET /events/positions/all?wallet=xxx — must be before /events/:id
  fastify.get<{ Querystring: { wallet?: string } }>(
    '/events/positions/all',
    async (request, reply) => {
      const wallet    = request.query.wallet ?? 'anon';
      const positions = await fastify.prisma.eventPosition.findMany({
        where:   { wallet },
        include: { event: true },
      });
      const result = positions.map((pos) => {
        const p = lmsrPrices(pos.event.qYes, pos.event.qNo);
        return {
          eventId:        pos.eventId,
          title:          pos.event.title,
          category:       pos.event.category,
          resolutionDate: Number(pos.event.resolutionDate),
          yesShares:      pos.yesShares,
          noShares:       pos.noShares,
          yesCost:        pos.yesCost,
          noCost:         pos.noCost,
          yesPrice:       p.yes,
          noPrice:        p.no,
          yesValue:       +(pos.yesShares * p.yes).toFixed(4),
          noValue:        +(pos.noShares  * p.no).toFixed(4),
        };
      });
      return reply.send({ positions: result });
    },
  );

  // GET /events — all Kaido-native events from DB
  fastify.get('/events', async (_req, reply) => {
    const rows   = await fastify.prisma.event.findMany({ orderBy: { createdAt: 'desc' } });
    const events = rows.map((e) => {
      const p = lmsrPrices(e.qYes, e.qNo);
      return { ...e, resolutionDate: Number(e.resolutionDate), yesPrice: +p.yes.toFixed(4), noPrice: +p.no.toFixed(4) };
    });
    return reply.send({ events });
  });

  // ── Polymarket proxies (Gamma / Data / CLOB) — must be before /events/:id so `poly` is not captured as :id

  fastify.get<{ Querystring: { token_id?: string } }>(
    '/events/poly/midpoint',
    async (request, reply) => {
      const tokenId = request.query.token_id;
      if (!tokenId) return reply.code(400).send({ error: 'token_id required' });
      const mid = await fastify.sdk.polymarket.getMidpoint(tokenId);
      if (mid === null) return reply.code(502).send({ error: 'Midpoint unavailable' });
      return reply.send({ token_id: tokenId, mid });
    },
  );

  fastify.get<{ Querystring: { token_id?: string } }>(
    '/events/poly/book',
    async (request, reply) => {
      const tokenId = request.query.token_id;
      if (!tokenId) return reply.code(400).send({ error: 'token_id required' });
      const book = await fastify.sdk.polymarket.getBook(tokenId);
      if (!book) return reply.code(502).send({ error: 'Order book unavailable' });
      return reply.send(book);
    },
  );

  fastify.get<{ Querystring: { token_id?: string } }>(
    '/events/poly/spread',
    async (request, reply) => {
      const tokenId = request.query.token_id;
      if (!tokenId) return reply.code(400).send({ error: 'token_id required' });
      const spread = await fastify.sdk.polymarket.getSpread(tokenId);
      if (!spread) return reply.code(502).send({ error: 'Spread unavailable' });
      return reply.send({ token_id: tokenId, ...spread });
    },
  );

  fastify.get<{ Querystring: { limit?: string; market?: string } }>(
    '/events/poly/trades',
    async (request, reply) => {
      const limit  = Math.min(parseInt(request.query.limit ?? '50', 10), 200);
      const market = request.query.market;
      const trades = await fastify.sdk.polymarket.getTrades({
        limit,
        ...(market ? { market } : {}),
      });
      return reply.send(trades);
    },
  );

  fastify.get<{ Querystring: { limit?: string; market?: string } }>(
    '/events/poly/activity',
    async (request, reply) => {
      const limit  = Math.min(parseInt(request.query.limit ?? '50', 10), 200);
      const market = request.query.market;
      const activity = await fastify.sdk.polymarket.getActivity({
        limit,
        ...(market ? { market } : {}),
      });
      return reply.send(activity);
    },
  );

  // GET /events/:id
  fastify.get<{ Params: { id: string } }>('/events/:id', async (request, reply) => {
    const e = await fastify.prisma.event.findUnique({ where: { id: request.params.id } });
    if (!e) return reply.code(404).send({ error: 'Event not found' });
    const p = lmsrPrices(e.qYes, e.qNo);
    return reply.send({
      event: { ...e, resolutionDate: Number(e.resolutionDate), yesPrice: +p.yes.toFixed(4), noPrice: +p.no.toFixed(4) },
    });
  });

  // GET /events/:id/activity
  fastify.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/events/:id/activity',
    async (request, reply) => {
      const limit    = Math.min(parseInt(request.query.limit ?? '20', 10), 50);
      const activity = await fastify.prisma.eventActivity.findMany({
        where:   { eventId: request.params.id },
        orderBy: { createdAt: 'desc' },
        take:    limit,
      });
      return reply.send({ activity });
    },
  );

  // POST /events/:id/bet — DB-persisted LMSR bet
  fastify.post<{
    Params: { id: string };
    Body:   { side: 'yes' | 'no'; amount: number; wallet?: string };
  }>('/events/:id/bet', async (request, reply) => {
    const { side, amount, wallet = 'anon' } = request.body;
    if (!amount || amount <= 0) return reply.code(400).send({ error: 'Invalid amount' });
    if (amount > 10_000) return reply.code(400).send({ error: 'Max bet: 10,000 USDC' });

    const result = await fastify.prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: request.params.id } });
      if (!event) throw Object.assign(new Error('Event not found'), { statusCode: 404 });

      const before = lmsrPrices(event.qYes, event.qNo);
      const { shares, newQYes, newQNo } = lmsrBuy(event.qYes, event.qNo, side, amount);
      const after  = lmsrPrices(newQYes, newQNo);

      await tx.event.update({
        where: { id: event.id },
        data:  { qYes: newQYes, qNo: newQNo, volume: event.volume + amount, liquidity: event.liquidity + amount * 0.1 },
      });

      await tx.eventPosition.upsert({
        where:  { eventId_wallet: { eventId: event.id, wallet } },
        create: {
          eventId:   event.id, wallet,
          yesShares: side === 'yes' ? shares : 0,
          noShares:  side === 'no'  ? shares : 0,
          yesCost:   side === 'yes' ? amount : 0,
          noCost:    side === 'no'  ? amount : 0,
        },
        update: side === 'yes'
          ? { yesShares: { increment: shares }, yesCost: { increment: amount } }
          : { noShares:  { increment: shares }, noCost:  { increment: amount } },
      });

      await tx.eventActivity.create({
        data: {
          eventId: event.id,
          wallet:  wallet.length > 8 ? wallet.slice(0, 4) + '…' + wallet.slice(-4) : wallet,
          side, amount,
          shares:  +shares.toFixed(4),
          price:   +(side === 'yes' ? before.yes : before.no).toFixed(4),
        },
      });

      return { shares, before, after };
    });

    return reply.send({
      success:         true,
      eventId:         request.params.id,
      side, amount,
      shares:          +result.shares.toFixed(4),
      priceBefore:     +result.before[side].toFixed(4),
      priceAfter:      +result.after[side].toFixed(4),
      potentialPayout: +result.shares.toFixed(4),
      yesPrice:        +result.after.yes.toFixed(4),
      noPrice:         +result.after.no.toFixed(4),
    });
  });

  // POST /events — create new prediction market (persisted to DB)
  fastify.post<{
    Body: { title: string; description: string; category: string; resolutionDate: number; initialYesPrice?: number };
  }>('/events', async (request, reply) => {
    const { title, description, category, resolutionDate, initialYesPrice = 0.5 } = request.body;
    if (!title || !description || !category || !resolutionDate) {
      return reply.code(400).send({ error: 'title, description, category, resolutionDate required' });
    }
    if (initialYesPrice <= 0 || initialYesPrice >= 1) {
      return reply.code(400).send({ error: 'initialYesPrice must be between 0 and 1 exclusive' });
    }

    const eY   = initialYesPrice / (1 - initialYesPrice);
    const qYes = LMSR_B * Math.log(eY);

    const event = await fastify.prisma.event.create({
      data: {
        id:             `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title, description, category,
        status:         'open',
        resolutionDate: BigInt(resolutionDate),
        qYes, qNo: 0,
        volume:         0,
        liquidity:      1000,
      },
    });

    const p = lmsrPrices(event.qYes, event.qNo);
    return reply.code(201).send({
      event: { ...event, resolutionDate: Number(event.resolutionDate), yesPrice: +p.yes.toFixed(4), noPrice: +p.no.toFixed(4) },
    });
  });
};
