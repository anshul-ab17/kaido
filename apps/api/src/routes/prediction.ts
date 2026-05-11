/**
 * Prediction market routes — proxies Jupiter Prediction API (server-side API key).
 * Falls back to Polymarket Gamma API when no Jupiter key is configured.
 *
 * GET  /prediction/events?category=&filter=&q=&limit=
 * GET  /prediction/markets/:marketId
 * POST /prediction/orders          { marketId, isYes, amountUsd, ownerPubkey }
 * GET  /prediction/positions?wallet=
 * POST /prediction/positions/:pubkey/claim   { ownerPubkey }
 * DELETE /prediction/positions/:pubkey       { ownerPubkey }
 */

import type { FastifyPluginAsync } from 'fastify';
import type { JupEvent, JupMarket } from '@repo/sdk';
import { microToProb } from '@repo/sdk';

// ── Shared output types (consumed by frontend) ────────────────────────────────

export interface PredSubtopic {
  id:              string;
  question:        string;
  yesPrice:        number;   // 0–1 probability
  noPrice:         number;
  volume:          number;   // USD
  endDate:         string;   // ISO string
  source:          'polymarket';
  url?:            string;
  jupiterMarketId?: string;  // present when Jupiter key configured → enables trading
  buyYesPriceUsd?: number;  // micro USD (Jupiter native)
  buyNoPriceUsd?:  number;  // micro USD
}

export interface PredTopic {
  id:        string;
  title:     string;
  category:  string;
  source:    'polymarket';
  volume:    number;
  liquidity: number;
  endDate:   string;
  subtopics: PredSubtopic[];
}

// ── Jupiter → PredTopic mapper ────────────────────────────────────────────────

function jupEventToTopic(e: JupEvent): PredTopic {
  const markets = (e.markets ?? []).filter((m) => m.status === 'open');
  const source  = markets.length > 0 ? markets : (e.markets ?? []).slice(0, 1);

  const subtopics: PredSubtopic[] = source.map((m: JupMarket): PredSubtopic => {
    const buyYes = m.pricing.buyYesPriceUsd ?? null;
    const buyNo  = m.pricing.buyNoPriceUsd  ?? null;
    const yesPrice = buyYes !== null ? microToProb(buyYes) : 0.5;
    return {
      id:              `jup_${m.marketId}`,
      question:        m.metadata.title || e.metadata.title,
      yesPrice,
      noPrice:         +(1 - yesPrice).toFixed(4),
      volume:          m.pricing.volume ?? 0,
      endDate:         new Date(m.closeTime * 1000).toISOString(),
      source:          'polymarket',
      url:             `https://jup.ag/prediction/${e.metadata.slug ?? e.eventId}`,
      jupiterMarketId: m.marketId,
      ...(buyYes !== null ? { buyYesPriceUsd: buyYes } : {}),
      ...(buyNo  !== null ? { buyNoPriceUsd:  buyNo  } : {}),
    };
  });

  const totalVolume = parseInt(e.volumeUsd, 10) / 1_000_000;

  return {
    id:        `jup_${e.eventId}`,
    title:     e.metadata.title,
    category:  e.category ?? 'Other',
    source:    'polymarket',
    volume:    totalVolume,
    liquidity: 0,
    endDate:   e.metadata.closeTime,
    subtopics,
  };
}


// ── Routes ────────────────────────────────────────────────────────────────────

export const predictionRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /prediction/events — Jupiter events (with trading) or Gamma fallback
  fastify.get<{ Querystring: { category?: string; filter?: string; q?: string; limit?: string } }>(
    '/prediction/events',
    async (request, reply) => {
      const limit    = Math.min(parseInt(request.query.limit ?? '60', 10), 100);
      const category = request.query.category;
      const filter   = request.query.filter;
      const q        = request.query.q?.trim();

      let topics: PredTopic[] = [];

      if (fastify.sdk.prediction) {
        // Jupiter Prediction API — full trading support
        try {
          const events = q
            ? await fastify.sdk.prediction.searchEvents(q, limit)
            : await fastify.sdk.prediction.getEvents({ category, filter, limit });
          topics = events
            .filter((e) => e.isActive && (e.markets?.length ?? 0) > 0)
            .map(jupEventToTopic)
            .filter((t) => t.subtopics.length > 0)
            .slice(0, limit);
        } catch (err) {
          fastify.log.warn({ err }, 'Jupiter prediction events failed');
        }
      }
      // No Jupiter key → return empty; client falls back to direct Gamma fetch in the browser

      const categories = ['All', ...new Set(topics.map((t) => t.category))].sort();
      return reply.send({ topics, categories, tradingEnabled: !!fastify.sdk.prediction, updatedAt: new Date().toISOString() });
    },
  );

  // GET /prediction/markets/:marketId — live pricing from Jupiter
  fastify.get<{ Params: { marketId: string } }>(
    '/prediction/markets/:marketId',
    async (request, reply) => {
      if (!fastify.sdk.prediction) return reply.code(503).send({ error: 'Jupiter API key not configured' });
      const market = await fastify.sdk.prediction.getMarket(request.params.marketId);
      if (!market) return reply.code(404).send({ error: 'Market not found' });
      return reply.send({ market });
    },
  );

  // POST /prediction/orders — build unsigned tx for buying YES/NO
  fastify.post<{
    Body: {
      ownerPubkey:  string;
      marketId:     string;
      isYes:        boolean;
      amountUsd:    number;   // dollars (e.g. 2.0 = $2)
      depositMint?: string;
    };
  }>(
    '/prediction/orders',
    async (request, reply) => {
      if (!fastify.sdk.prediction) return reply.code(503).send({ error: 'Jupiter API key not configured' });

      const { ownerPubkey, marketId, isYes, amountUsd, depositMint } = request.body;
      if (!ownerPubkey || !marketId || amountUsd === undefined) {
        return reply.code(400).send({ error: 'ownerPubkey, marketId, amountUsd required' });
      }
      if (amountUsd < 0.01 || amountUsd > 10_000) {
        return reply.code(400).send({ error: 'amountUsd must be between $0.01 and $10,000' });
      }

      const depositAmount = String(Math.round(amountUsd * 1_000_000));
      const result = await fastify.sdk.prediction.createOrder({
        ownerPubkey, marketId, isYes, isBuy: true, depositAmount, depositMint,
      });

      return reply.send(result);
    },
  );

  // GET /prediction/positions?wallet=
  fastify.get<{ Querystring: { wallet?: string } }>(
    '/prediction/positions',
    async (request, reply) => {
      if (!fastify.sdk.prediction) return reply.code(503).send({ error: 'Jupiter API key not configured' });
      const wallet = request.query.wallet;
      if (!wallet) return reply.code(400).send({ error: 'wallet required' });
      const positions = await fastify.sdk.prediction.getPositions(wallet);
      return reply.send({ positions });
    },
  );

  // POST /prediction/positions/:pubkey/claim
  fastify.post<{ Params: { pubkey: string }; Body: { ownerPubkey: string } }>(
    '/prediction/positions/:pubkey/claim',
    async (request, reply) => {
      if (!fastify.sdk.prediction) return reply.code(503).send({ error: 'Jupiter API key not configured' });
      const result = await fastify.sdk.prediction.claimPosition(request.params.pubkey, request.body.ownerPubkey);
      return reply.send(result);
    },
  );

  // DELETE /prediction/positions/:pubkey (close / sell all)
  fastify.delete<{ Params: { pubkey: string } }>(
    '/prediction/positions/:pubkey',
    async (request, reply) => {
      if (!fastify.sdk.prediction) return reply.code(503).send({ error: 'Jupiter API key not configured' });
      const result = await fastify.sdk.prediction.closePosition(request.params.pubkey);
      return reply.send(result);
    },
  );
};
