import type { FundingRate, SolanaCluster } from '../types.js';

const MARKETS = [
  { symbol: 'SOL-PERP', index: 0 },
  { symbol: 'BTC-PERP', index: 1 },
  { symbol: 'ETH-PERP', index: 2 },
  { symbol: 'BNB-PERP', index: 3 },
  { symbol: 'ARB-PERP', index: 4 },
  { symbol: 'OP-PERP',  index: 5 },
] as const;

interface DriftFundingRecord {
  fundingRate:     string;
  oraclePriceTwap: string;
}

export class DriftClient {
  private base: string;

  constructor(cluster: SolanaCluster = 'devnet') {
    this.base =
      cluster === 'devnet' ? 'https://devnet-beta.drift.trade' : 'https://mainnet-beta.drift.trade';
  }

  async getFundingRates(): Promise<FundingRate[]> {
    const out: FundingRate[] = [];
    for (const m of MARKETS) {
      try {
        const res = await fetch(`${this.base}/perpFundingRate?marketIndex=${m.index}`, {
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as DriftFundingRecord;
        const rate8h = parseFloat(data.fundingRate) / 1e9;
        out.push({
          market:       m.symbol,
          rate:         rate8h,
          annualized:   +(rate8h * 3 * 365 * 100).toFixed(2),
          direction:    (rate8h >= 0 ? 'long' : 'short') as 'long' | 'short',
          openInterest: 0,
        });
      } catch { /* skip market */ }
    }
    return out;
  }
}
