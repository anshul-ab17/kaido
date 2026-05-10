import type { FastifyPluginAsync } from 'fastify';
import type { PredictionEvent } from '@repo/types';

// ── LMSR (kept for Kaido-native events created via POST /events) ─────────────

const LMSR_B = 1000;

interface LMSRState { qYes: number; qNo: number }

function lmsrPrices(s: LMSRState): { yes: number; no: number } {
  const eY = Math.exp(s.qYes / LMSR_B);
  const eN = Math.exp(s.qNo  / LMSR_B);
  const sum = eY + eN;
  return { yes: eY / sum, no: eN / sum };
}

function lmsrBuy(s: LMSRState, side: 'yes' | 'no', amount: number): { shares: number; newState: LMSRState } {
  const C = (qY: number, qN: number) => LMSR_B * Math.log(Math.exp(qY / LMSR_B) + Math.exp(qN / LMSR_B));
  const before = C(s.qYes, s.qNo);
  let lo = 0, hi = amount * 10;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    const after = C(side === 'yes' ? s.qYes + mid : s.qYes, side === 'no' ? s.qNo + mid : s.qNo);
    if (after - before < amount) lo = mid; else hi = mid;
  }
  const shares = (lo + hi) / 2;
  return { shares, newState: { qYes: side === 'yes' ? s.qYes + shares : s.qYes, qNo: side === 'no' ? s.qNo + shares : s.qNo } };
}

function initLMSR(yesPrice: number): LMSRState {
  const eY = yesPrice / (1 - yesPrice);
  return { qYes: LMSR_B * Math.log(eY), qNo: 0 };
}

interface EventActivity { id: string; wallet: string; side: 'yes' | 'no'; amount: number; shares: number; price: number; timestamp: number }
interface UserPosition { yesShares: number; noShares: number; yesCost: number; noCost: number }
interface LiveEvent { data: PredictionEvent; lmsr: LMSRState; activity: EventActivity[]; positions: Map<string, UserPosition> }

const EVENTS = new Map<string, LiveEvent>();

function seedEvent(e: PredictionEvent) {
  EVENTS.set(e.id, { data: e, lmsr: initLMSR(e.yesPrice), activity: [], positions: new Map() });
}

// ── Polymarket types ──────────────────────────────────────────────────────────

interface PolyMarket {
  id:             string;
  question?:      string;
  outcomePrices?: string;
  volume?:        number;
  liquidity?:     number;
  endDate?:       string;
  active?:        boolean;
}

interface PolyEvent {
  id:         string;
  title:      string;
  slug?:      string;
  category?:  string;
  endDate?:   string;
  volume?:    number;
  liquidity?: number;
  markets?:   PolyMarket[];
  tags?:      Array<{ label?: string; slug?: string }>;
}

// ── Kalshi types ──────────────────────────────────────────────────────────────

interface KalshiMarket {
  ticker:          string;
  title?:          string;
  yes_bid?:        number;
  yes_ask?:        number;
  last_price?:     number;
  volume?:         number;
  open_interest?:  number;
  close_time?:     string;
}

interface KalshiEvent {
  event_ticker: string;
  title:        string;
  category?:    string;
  sub_title?:   string;
  markets?:     KalshiMarket[];
}

interface KalshiEventsResponse {
  events:      KalshiEvent[];
  cursor?:     string;
}

// ── Subtopic / Topic shapes returned to frontend ──────────────────────────────

export interface EventSubtopic {
  id:             string;
  question:       string;
  yesPrice:       number;
  noPrice:        number;
  volume:         number;
  endDate:        string;
  source:         'polymarket' | 'kalshi';
  url?:           string;
}

export interface EventTopic {
  id:             string;
  title:          string;
  category:       string;
  source:         'polymarket' | 'kalshi';
  volume:         number;
  liquidity:      number;
  endDate:        string;
  subtopics:      EventSubtopic[];
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchPolyTopics(limit: number): Promise<EventTopic[]> {
  try {
    const res = await fetch(
      `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=${limit}&order=volume&ascending=false`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as PolyEvent[];

    return data
      .filter((e) => e.title && e.markets && e.markets.length > 0)
      .map((e): EventTopic => {
        const subtopics: EventSubtopic[] = (e.markets ?? []).map((m): EventSubtopic => {
          let yesPrice = 0.5;
          try {
            const prices = JSON.parse(m.outcomePrices ?? '[]') as number[];
            if (prices[0] !== undefined) yesPrice = Math.max(0.01, Math.min(0.99, Number(prices[0])));
          } catch { /* ignore */ }
          return {
            id:        `poly_mkt_${m.id}`,
            question:  m.question ?? e.title,
            yesPrice:  +yesPrice.toFixed(4),
            noPrice:   +(1 - yesPrice).toFixed(4),
            volume:    m.volume ?? 0,
            endDate:   m.endDate ?? e.endDate ?? '',
            source:    'polymarket',
            url:       `https://polymarket.com/event/${e.slug ?? e.id}`,
          };
        });

        return {
          id:        `poly_${e.id}`,
          title:     e.title,
          category:  e.category ?? (e.tags?.[0]?.label ?? 'Other'),
          source:    'polymarket',
          volume:    e.volume ?? 0,
          liquidity: e.liquidity ?? 0,
          endDate:   e.endDate ?? '',
          subtopics,
        };
      });
  } catch {
    return [];
  }
}

async function fetchKalshiTopics(limit: number): Promise<EventTopic[]> {
  try {
    const res = await fetch(
      `https://trading-api.kalshi.com/trade-api/v2/events?limit=${limit}&status=open`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as KalshiEventsResponse;

    return (data.events ?? [])
      .filter((e) => e.title)
      .map((e): EventTopic => {
        const subtopics: EventSubtopic[] = (e.markets ?? []).map((m): EventSubtopic => {
          const yesBid   = (m.yes_bid   ?? 0) / 100;
          const yesAsk   = (m.yes_ask   ?? 0) / 100;
          const lastPrice = (m.last_price ?? 50) / 100;
          const yesPrice = yesBid > 0 && yesAsk > 0 ? (yesBid + yesAsk) / 2 : lastPrice;
          return {
            id:       `kalshi_${m.ticker}`,
            question:  m.title ?? e.title,
            yesPrice: +Math.max(0.01, Math.min(0.99, yesPrice)).toFixed(4),
            noPrice:  +(1 - Math.max(0.01, Math.min(0.99, yesPrice))).toFixed(4),
            volume:    m.volume ?? 0,
            endDate:   m.close_time ?? '',
            source:    'kalshi',
            url:       `https://kalshi.com/markets/${m.ticker}`,
          };
        });

        // If no markets array, create a single subtopic from the event itself
        if (subtopics.length === 0) {
          subtopics.push({
            id:       `kalshi_${e.event_ticker}`,
            question:  e.sub_title ?? e.title,
            yesPrice:  0.5,
            noPrice:   0.5,
            volume:    0,
            endDate:   '',
            source:    'kalshi',
            url:       `https://kalshi.com/markets/${e.event_ticker}`,
          });
        }

        const totalVolume = subtopics.reduce((s, m) => s + m.volume, 0);
        const latestEnd   = subtopics.reduce((latest, m) => m.endDate > latest ? m.endDate : latest, '');

        return {
          id:        `kalshi_${e.event_ticker}`,
          title:     e.title,
          category:  e.category ?? 'Other',
          source:    'kalshi',
          volume:    totalVolume,
          liquidity: 0,
          endDate:   latestEnd,
          subtopics,
        };
      });
  } catch {
    return [];
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

export const eventRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /events/topics — live feed from Polymarket + Kalshi, grouped as topics with subtopics
  fastify.get<{ Querystring: { source?: string; limit?: string; category?: string } }>(
    '/events/topics',
    async (request, reply) => {
      const source   = request.query.source   ?? 'all';
      const limit    = Math.min(parseInt(request.query.limit ?? '50', 10), 100);
      const category = request.query.category;

      const [polyTopics, kalshiTopics] = await Promise.all([
        source !== 'kalshi' ? fetchPolyTopics(limit)   : Promise.resolve([]),
        source !== 'poly'   ? fetchKalshiTopics(limit) : Promise.resolve([]),
      ]);

      let topics = [...polyTopics, ...kalshiTopics];

      if (category && category !== 'All') {
        topics = topics.filter((t) => t.category === category);
      }

      // Collect all unique categories across both sources
      const categories = ['All', ...new Set(topics.map((t) => t.category))].sort();

      return reply.send({ topics, categories, updatedAt: new Date().toISOString() });
    },
  );

  // GET /events — legacy: return Kaido-native in-memory events only
  fastify.get('/events', async (_req, reply) => {
    const events = [...EVENTS.values()].map((e) => {
      const prices = lmsrPrices(e.lmsr);
      return { ...e.data, yesPrice: +prices.yes.toFixed(4), noPrice: +prices.no.toFixed(4) };
    });
    return reply.send({ events });
  });

  // GET /events/:id
  fastify.get<{ Params: { id: string } }>('/events/:id', async (request, reply) => {
    const live = EVENTS.get(request.params.id);
    if (!live) return reply.code(404).send({ error: 'Event not found' });
    const prices = lmsrPrices(live.lmsr);
    return reply.send({ event: { ...live.data, yesPrice: +prices.yes.toFixed(4), noPrice: +prices.no.toFixed(4) } });
  });

  // GET /events/:id/activity
  fastify.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/events/:id/activity',
    async (request, reply) => {
      const live = EVENTS.get(request.params.id);
      if (!live) return reply.code(404).send({ error: 'Event not found' });
      const limit = Math.min(parseInt(request.query.limit ?? '20', 10), 50);
      return reply.send({ activity: live.activity.slice(-limit).reverse() });
    },
  );

  // GET /events/positions/all?wallet=xxx
  fastify.get<{ Querystring: { wallet?: string } }>(
    '/events/positions/all',
    async (request, reply) => {
      const wallet = request.query.wallet ?? 'anon';
      const result = [];
      for (const [id, live] of EVENTS.entries()) {
        const pos = live.positions.get(wallet);
        if (!pos || (pos.yesShares === 0 && pos.noShares === 0)) continue;
        const prices = lmsrPrices(live.lmsr);
        result.push({
          eventId: id, title: live.data.title, category: live.data.category,
          resolutionDate: live.data.resolutionDate,
          yesShares: pos.yesShares, noShares: pos.noShares,
          yesCost: pos.yesCost, noCost: pos.noCost,
          yesPrice: prices.yes, noPrice: prices.no,
          yesValue: +(pos.yesShares * prices.yes).toFixed(4),
          noValue:  +(pos.noShares  * prices.no).toFixed(4),
        });
      }
      return reply.send({ positions: result });
    },
  );

  // POST /events/:id/bet — Kaido-native LMSR bet
  fastify.post<{ Params: { id: string }; Body: { side: 'yes' | 'no'; amount: number; wallet?: string } }>(
    '/events/:id/bet',
    async (request, reply) => {
      const live = EVENTS.get(request.params.id);
      if (!live) return reply.code(404).send({ error: 'Event not found' });
      const { side, amount, wallet = 'anon' } = request.body;
      if (!amount || amount <= 0) return reply.code(400).send({ error: 'Invalid amount' });
      if (amount > 10_000) return reply.code(400).send({ error: 'Max bet: 10,000 USDC' });

      const before = lmsrPrices(live.lmsr);
      const { shares, newState } = lmsrBuy(live.lmsr, side, amount);
      live.lmsr = newState;
      const after = lmsrPrices(live.lmsr);
      live.data.volume   += amount;
      live.data.liquidity += amount * 0.1;

      const pos = live.positions.get(wallet) ?? { yesShares: 0, noShares: 0, yesCost: 0, noCost: 0 };
      if (side === 'yes') { pos.yesShares += shares; pos.yesCost += amount; }
      else               { pos.noShares  += shares; pos.noCost  += amount; }
      live.positions.set(wallet, pos);

      const act: EventActivity = {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        wallet: wallet.slice(0, 4) + '…' + wallet.slice(-4),
        side, amount, shares: +shares.toFixed(4),
        price: +(side === 'yes' ? before.yes : before.no).toFixed(4),
        timestamp: Date.now(),
      };
      live.activity.push(act);
      if (live.activity.length > 200) live.activity.shift();

      return reply.send({
        success: true, eventId: live.data.id, side, amount,
        shares: +shares.toFixed(4),
        priceBefore: +before[side].toFixed(4),
        priceAfter:  +after[side].toFixed(4),
        potentialPayout: +shares.toFixed(4),
        yesPrice: +after.yes.toFixed(4),
        noPrice:  +after.no.toFixed(4),
      });
    },
  );

  // POST /events — create Kaido-native prediction market
  fastify.post<{ Body: { title: string; description: string; category: string; resolutionDate: number; initialYesPrice?: number } }>(
    '/events',
    async (request, reply) => {
      const { title, description, category, resolutionDate, initialYesPrice = 0.5 } = request.body;
      if (!title || !description || !category || !resolutionDate) {
        return reply.code(400).send({ error: 'Missing required fields' });
      }
      if (initialYesPrice <= 0 || initialYesPrice >= 1) {
        return reply.code(400).send({ error: 'initialYesPrice must be between 0 and 1 exclusive' });
      }
      const id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newEvent: PredictionEvent = {
        id, title, description, category, status: 'open', resolutionDate,
        yesPrice: initialYesPrice, noPrice: +(1 - initialYesPrice).toFixed(4),
        volume: 0, liquidity: 1000, createdAt: Date.now(),
      };
      seedEvent(newEvent);
      return reply.code(201).send({ event: newEvent });
    },
  );
};
