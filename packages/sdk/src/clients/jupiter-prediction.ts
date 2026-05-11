/**
 * Jupiter Prediction API client (read + write).
 * Base URL: https://api.jup.ag/prediction/v1
 * Auth: x-api-key header (server-side only, never expose to browser).
 * Amounts: all USD values in micro-USD where 1_000_000 = $1.00.
 */

const PREDICTION_BASE = 'https://api.jup.ag/prediction/v1';

// ── Jupiter response shapes (partial) ────────────────────────────────────────

export interface JupMarketPricing {
  buyYesPriceUsd:  number | null; // micro USD
  buyNoPriceUsd:   number | null;
  sellYesPriceUsd: number | null;
  sellNoPriceUsd:  number | null;
  volume:          number;
}

export interface JupMarket {
  marketId:  string;
  status:    'open' | 'closed' | 'cancelled';
  result:    null | 'yes' | 'no';
  closeTime: number; // unix timestamp
  imageUrl:  string;
  metadata:  { title: string; status: string; openTime: number; closeTime: number };
  pricing:   JupMarketPricing;
}

export interface JupEventMetadata {
  eventId:   string;
  title:     string;
  subtitle:  string;
  slug:      string;
  closeTime: string;
  imageUrl:  string;
  isLive:    boolean;
}

export interface JupEvent {
  eventId:        string;
  isActive:       boolean;
  isLive:         boolean;
  category:       string;
  subcategory:    string;
  tags:           string[];
  metadata:       JupEventMetadata;
  markets?:       JupMarket[];
  volumeUsd:      string; // micro USD string
  closeCondition: string;
  beginAt:        string | null;
}

export interface JupPosition {
  pubkey:                  string;
  ownerPubkey:             string;
  marketId:                string;
  isYes:                   boolean;
  contracts:               string;
  avgPriceUsd:             string;  // micro USD
  totalCostUsd:            string;  // micro USD
  valueUsd:                string | null;
  markPriceUsd:            string | null;
  pnlUsd:                  string | null;
  pnlUsdPercent:           number | null;
  payoutUsd:               string;  // micro USD
  claimable:               boolean;
  claimed:                 boolean;
  claimedUsd:              string;
  openedAt:                number;  // unix ts
  updatedAt:               number;
  claimableAt:             number | null;
  settlementDate:          number | null;
  eventMetadata:           { title: string; slug: string; category: string };
  marketMetadata:          { title: string };
}

export interface JupOrderResponse {
  transaction: string;           // base64 unsigned tx
  txMeta: {
    blockhash:            string;
    lastValidBlockHeight: number;
  };
  order: {
    orderPubkey:          string;
    positionPubkey:       string;
    contracts:            string;
    orderCostUsd:         string;
    estimatedTotalFeeUsd: string;
  };
}

// ── Params ────────────────────────────────────────────────────────────────────

export interface JupGetEventsParams {
  category?:       string; // all|crypto|sports|politics|esports|culture|economics|tech
  filter?:         string; // new|live|trending
  provider?:       string; // polymarket|kalshi
  includeMarkets?: boolean;
  limit?:          number;
}

export interface JupCreateOrderParams {
  ownerPubkey:   string;
  marketId:      string;
  isYes:         boolean;
  isBuy:         boolean;
  depositAmount: string; // micro USD string  e.g. '2000000' = $2
  depositMint?:  string; // default USDC
}

// ── Micro-USD helpers ─────────────────────────────────────────────────────────

export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/** micro-USD → dollars (floating point) */
export function microToUsd(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? parseInt(v, 10) : v;
  return Number.isFinite(n) ? n / 1_000_000 : 0;
}

/** dollars → micro-USD string for API */
export function usdToMicro(dollars: number): string {
  return String(Math.round(dollars * 1_000_000));
}

/** micro-USD → probability (0–1) — price of a contract that pays $1 */
export function microToProb(v: number | null | undefined): number {
  if (v === null || v === undefined) return 0.5;
  return Math.max(0.01, Math.min(0.99, v / 1_000_000));
}

// ── Client ────────────────────────────────────────────────────────────────────

export class JupiterPredictionClient {
  constructor(private readonly apiKey: string) {}

  private headers() {
    return { 'x-api-key': this.apiKey, Accept: 'application/json', 'Content-Type': 'application/json' };
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${PREDICTION_BASE}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      headers: this.headers(),
      signal:  AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Jupiter Prediction ${res.status} ${path}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${PREDICTION_BASE}${path}`, {
      method:  'POST',
      headers: this.headers(),
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const b = await res.text().catch(() => '');
      throw new Error(`Jupiter Prediction ${res.status} ${path}: ${b}`);
    }
    return res.json() as Promise<T>;
  }

  private async del<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${PREDICTION_BASE}${path}`, {
      method:  'DELETE',
      headers: this.headers(),
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal:  AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const b = await res.text().catch(() => '');
      throw new Error(`Jupiter Prediction ${res.status} ${path}: ${b}`);
    }
    return res.json() as Promise<T>;
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  async getEvents(params?: JupGetEventsParams): Promise<JupEvent[]> {
    const p: Record<string, string> = { includeMarkets: 'true' };
    if (params?.category && params.category !== 'all') p['category'] = params.category;
    if (params?.filter)   p['filter']   = params.filter;
    if (params?.provider) p['provider'] = params.provider;
    if (params?.limit)    p['limit']    = String(params.limit);
    const res = await this.get<{ data: JupEvent[] }>('/events', p);
    return Array.isArray(res.data) ? res.data : [];
  }

  async searchEvents(query: string, limit = 20): Promise<JupEvent[]> {
    const res = await this.get<{ data: JupEvent[] }>('/events/search', { query, limit: String(limit) });
    return Array.isArray(res.data) ? res.data : [];
  }

  async getMarket(marketId: string): Promise<JupMarket | null> {
    try { return await this.get<JupMarket>(`/markets/${marketId}`); }
    catch { return null; }
  }

  // ── Orders ─────────────────────────────────────────────────────────────────

  /** Returns a base64-encoded unsigned VersionedTransaction to sign + submit. */
  async createOrder(params: JupCreateOrderParams): Promise<JupOrderResponse> {
    return this.post<JupOrderResponse>('/orders', {
      ownerPubkey:   params.ownerPubkey,
      marketId:      params.marketId,
      isYes:         params.isYes,
      isBuy:         params.isBuy,
      depositAmount: params.depositAmount,
      depositMint:   params.depositMint ?? USDC_MINT,
    });
  }

  async getOrders(ownerPubkey: string): Promise<unknown[]> {
    const res = await this.get<{ data: unknown[] }>('/orders', { ownerPubkey });
    return Array.isArray(res.data) ? res.data : [];
  }

  // ── Positions ──────────────────────────────────────────────────────────────

  async getPositions(ownerPubkey: string): Promise<JupPosition[]> {
    const res = await this.get<{ data: JupPosition[] }>('/positions', { ownerPubkey });
    return Array.isArray(res.data) ? res.data : [];
  }

  /** Claim winnings from a settled YES position. Returns unsigned tx. */
  async claimPosition(positionPubkey: string, ownerPubkey: string): Promise<JupOrderResponse> {
    return this.post<JupOrderResponse>(`/positions/${positionPubkey}/claim`, { ownerPubkey });
  }

  /** Sell all contracts (close position). Returns unsigned tx. */
  async closePosition(positionPubkey: string): Promise<JupOrderResponse> {
    return this.del<JupOrderResponse>(`/positions/${positionPubkey}`);
  }
}
