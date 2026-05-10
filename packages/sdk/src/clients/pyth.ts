const HERMES = 'https://hermes.pyth.network';

const FEEDS = [
  { symbol: 'SOL-PERP', id: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d' },
  { symbol: 'BTC-PERP', id: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43' },
  { symbol: 'ETH-PERP', id: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace' },
] as const;

interface HermesEntry {
  id:    string;
  price: { price: string; expo: number };
}

export class PythClient {
  private idToSymbol = Object.fromEntries(FEEDS.map((f) => [f.id, f.symbol]));

  async getPrices(): Promise<Record<string, number>> {
    const ids = FEEDS.map((f) => `ids[]=${f.id}`).join('&');
    const res = await fetch(`${HERMES}/v2/updates/price/latest?${ids}&parsed=true`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`Pyth Hermes ${res.status}`);
    const data = (await res.json()) as { parsed: HermesEntry[] };
    const out: Record<string, number> = {};
    for (const e of data.parsed) {
      const sym = this.idToSymbol[e.id];
      if (sym) out[sym] = parseFloat(e.price.price) * Math.pow(10, e.price.expo);
    }
    return out;
  }
}
