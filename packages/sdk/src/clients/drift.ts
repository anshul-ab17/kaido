import type { FundingRate } from '../types.js';

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
  private base = 'https://mainnet-beta.drift.trade';

  async getFundingRates(): Promise<FundingRate[]> {
    const results = await Promise.allSettled(
      MARKETS.map(async (m) => {
        const res = await fetch(`${this.base}/perpFundingRate?marketIndex=${m.index}`, {
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) throw new Error(`Drift funding ${m.symbol} ${res.status}`);
        const data = (await res.json()) as DriftFundingRecord;
        const rate8h = parseFloat(data.fundingRate) / 1e9;
        return {
          market:       m.symbol,
          rate:         rate8h,
          annualized:   +(rate8h * 3 * 365 * 100).toFixed(2),
          direction:    (rate8h >= 0 ? 'long' : 'short') as 'long' | 'short',
          openInterest: 0,
        } satisfies FundingRate;
      }),
    );

    return results
      .filter((r): r is PromiseFulfilledResult<FundingRate> => r.status === 'fulfilled')
      .map((r) => r.value);
  }
}
