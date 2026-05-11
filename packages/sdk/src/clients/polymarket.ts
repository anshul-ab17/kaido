/**
 * Polymarket public APIs (read-only):
 * - Gamma: discovery (events, markets, tags)
 * - Data: activity / trades / positions-style aggregates
 * - CLOB: orderbook, midpoint, spread (no auth for reads)
 */

export const POLY_GAMMA = 'https://gamma-api.polymarket.com';
export const POLY_DATA  = 'https://data-api.polymarket.com';
export const POLY_CLOB  = 'https://clob.polymarket.com';

// ── Gamma shapes (partial) ───────────────────────────────────────────────────

interface GammaMarket {
  id:              string;
  question?:       string;
  outcomePrices?:  string;
  volume?:         number | string;
  liquidity?:      number | string;
  endDate?:        string;
  active?:         boolean;
  closed?:         boolean;
  clobTokenIds?:   string;
}

interface GammaEvent {
  id:          string;
  title:       string;
  slug?:       string;
  category?:   string;
  endDate?:    string;
  volume?:     number | string;
  liquidity?:  number | string;
  markets?:    GammaMarket[];
  tags?:       Array<{ label?: string; slug?: string }>;
}

/** Sub-topic row aligned with Kaido `/events/topics` UI. */
export interface PolymarketSubtopic {
  id:         string;
  question:   string;
  yesPrice:   number;
  noPrice:    number;
  volume:     number;
  endDate:    string;
  source:     'polymarket';
  url?:       string;
  conditionId?: string;
  yesTokenId?: string;
}

export interface PolymarketTopic {
  id:         string;
  title:      string;
  category:   string;
  source:     'polymarket';
  volume:     number;
  liquidity:  number;
  endDate:    string;
  subtopics:  PolymarketSubtopic[];
}

function num(v: number | string | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function parseYesPrice(outcomePrices: string | undefined): number {
  let yes = 0.5;
  try {
    const arr = JSON.parse(outcomePrices ?? '[]') as unknown[];
    const first = arr[0];
    const raw   = typeof first === 'string' ? parseFloat(first) : Number(first);
    if (Number.isFinite(raw)) yes = Math.max(0.01, Math.min(0.99, raw));
  } catch { /* keep default */ }
  return +yes.toFixed(4);
}

function parseClobTokenIds(raw: string | undefined): { yes?: string; no?: string } {
  try {
    const ids = JSON.parse(raw ?? '[]') as string[];
    const out: { yes?: string; no?: string } = {};
    if (ids[0]) out.yes = ids[0];
    if (ids[1]) out.no = ids[1];
    return out;
  } catch {
    return {};
  }
}

export class PolymarketClient {
  /** Gamma: active events with markets, ordered by volume (discovery feed). */
  async getEventTopics(limit: number): Promise<PolymarketTopic[]> {
    const url =
      `${POLY_GAMMA}/events?active=true&closed=false&limit=${limit}&order=volume&ascending=false`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal:  AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`Polymarket Gamma ${res.status}`);

    const data = (await res.json()) as GammaEvent[];

    return data
      .filter((e) => e.title && e.markets && e.markets.length > 0)
      .map((e): PolymarketTopic => {
        const subtopics: PolymarketSubtopic[] = (e.markets ?? [])
          .filter((m) => m.active !== false && m.closed !== true)
          .map((m): PolymarketSubtopic => {
            const yesPrice = parseYesPrice(m.outcomePrices);
            const tokens   = parseClobTokenIds(m.clobTokenIds);
            const conditionId = (m as { conditionId?: string }).conditionId;
            return {
              id:          `poly_mkt_${m.id}`,
              question:    m.question ?? e.title,
              yesPrice,
              noPrice:     +(1 - yesPrice).toFixed(4),
              volume:      num(m.volume),
              endDate:     m.endDate ?? e.endDate ?? '',
              source:      'polymarket',
              url:         `https://polymarket.com/event/${e.slug ?? e.id}`,
              ...(conditionId ? { conditionId } : {}),
              ...(tokens.yes ? { yesTokenId: tokens.yes } : {}),
            };
          });

        // If all child markets were filtered out, keep at least one row from raw markets
        if (subtopics.length === 0 && (e.markets?.length ?? 0) > 0) {
          const m = e.markets![0]!;
          const yesPrice = parseYesPrice(m.outcomePrices);
          const tokens   = parseClobTokenIds(m.clobTokenIds);
          const conditionId = (m as { conditionId?: string }).conditionId;
          subtopics.push({
            id:          `poly_mkt_${m.id}`,
            question:    m.question ?? e.title,
            yesPrice,
            noPrice:     +(1 - yesPrice).toFixed(4),
            volume:      num(m.volume),
            endDate:     m.endDate ?? e.endDate ?? '',
            source:      'polymarket',
            url:         `https://polymarket.com/event/${e.slug ?? e.id}`,
            ...(conditionId ? { conditionId } : {}),
            ...(tokens.yes ? { yesTokenId: tokens.yes } : {}),
          });
        }

        return {
          id:        `poly_${e.id}`,
          title:     e.title,
          category:  e.category ?? (e.tags?.[0]?.label ?? 'Other'),
          source:    'polymarket',
          volume:    num(e.volume),
          liquidity: num(e.liquidity),
          endDate:   e.endDate ?? '',
          subtopics,
        };
      });
  }

  /**
   * Filter topics by title / sub-question (Gamma has no stable public FTS in-tree;
   * we pull a larger page from Gamma then filter locally).
   */
  async searchEventTopics(q: string, limit = 20): Promise<PolymarketTopic[]> {
    const needle = q.toLowerCase().trim();
    if (!needle) return this.getEventTopics(limit);
    const pool = await this.getEventTopics(Math.min(100, Math.max(limit * 4, 40)));
    return pool
      .filter(
        (t) =>
          t.title.toLowerCase().includes(needle) ||
          t.subtopics.some((s) => s.question.toLowerCase().includes(needle)),
      )
      .slice(0, limit);
  }

  /** Data API: recent trades (global or filtered when supported). */
  async getTrades(params?: { limit?: number; market?: string }): Promise<unknown[]> {
    const limit = Math.min(params?.limit ?? 50, 200);
    const qs    = new URLSearchParams({ limit: String(limit) });
    if (params?.market) qs.set('market', params.market);
    const res = await fetch(`${POLY_DATA}/trades?${qs}`, {
      headers: { Accept: 'application/json' },
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? data : [];
  }

  /** Data API: activity feed (shape varies by Polymarket version). */
  async getActivity(params?: { limit?: number; market?: string }): Promise<unknown[]> {
    const limit = Math.min(params?.limit ?? 50, 200);
    const qs    = new URLSearchParams({ limit: String(limit) });
    if (params?.market) qs.set('market', params.market);
    const res = await fetch(`${POLY_DATA}/activity?${qs}`, {
      headers: { Accept: 'application/json' },
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? data : [];
  }

  /** CLOB: midpoint price for YES outcome token (0–1). */
  async getMidpoint(tokenId: string): Promise<number | null> {
    if (!tokenId) return null;
    const res = await fetch(`${POLY_CLOB}/midpoint?token_id=${encodeURIComponent(tokenId)}`, {
      headers: { Accept: 'application/json' },
      signal:  AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { mid?: string } | string;
      if (typeof j === 'string') {
        const v = parseFloat(j);
        return Number.isFinite(v) ? v : null;
      }
      if (j && typeof j === 'object' && 'mid' in j && j.mid !== undefined) {
        const v = parseFloat(String(j.mid));
        return Number.isFinite(v) ? v : null;
      }
    } catch {
      const v = parseFloat(text);
      return Number.isFinite(v) ? v : null;
    }
    return null;
  }

  /** CLOB: full order book for a token id. */
  async getBook(tokenId: string): Promise<{ bids: unknown[]; asks: unknown[] } | null> {
    if (!tokenId) return null;
    const res = await fetch(`${POLY_CLOB}/book?token_id=${encodeURIComponent(tokenId)}`, {
      headers: { Accept: 'application/json' },
      signal:  AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { bids?: unknown[]; asks?: unknown[] };
    return {
      bids: Array.isArray(data.bids) ? data.bids : [],
      asks: Array.isArray(data.asks) ? data.asks : [],
    };
  }

  /** CLOB: bid / ask spread summary when available. */
  async getSpread(tokenId: string): Promise<{ bid: number; ask: number } | null> {
    if (!tokenId) return null;
    const res = await fetch(`${POLY_CLOB}/spread?token_id=${encodeURIComponent(tokenId)}`, {
      headers: { Accept: 'application/json' },
      signal:  AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    try {
      const data = (await res.json()) as { bid?: string; ask?: string };
      const bid = parseFloat(data.bid ?? '');
      const ask = parseFloat(data.ask ?? '');
      if (!Number.isFinite(bid) || !Number.isFinite(ask)) return null;
      return { bid, ask };
    } catch {
      return null;
    }
  }
}
