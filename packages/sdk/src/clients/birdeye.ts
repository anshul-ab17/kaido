import type { OrderLevel } from '../types.js';

const PUBLIC_BASE = 'https://public_api.birdeye.so';
const PRO_BASE    = 'https://api.birdeye.so';

export class BirdeyeClient {
  constructor(private apiKey?: string) {}

  private headers() {
    return {
      accept: 'application/json',
      ...(this.apiKey ? { 'X-API-KEY': this.apiKey } : {}),
    };
  }

  async getTokenPrice(mintAddress: string): Promise<number> {
    const res = await fetch(`${PUBLIC_BASE}/defi/price?address=${mintAddress}`, {
      headers: this.headers(),
      signal:  AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`Birdeye price ${res.status}`);
    const data = (await res.json()) as { data: { value: number } };
    return data.data.value;
  }

  async getOrderbook(
    mintAddress: string,
    limit = 14,
  ): Promise<{ bids: OrderLevel[]; asks: OrderLevel[] }> {
    if (this.apiKey) {
      const res = await fetch(`${PRO_BASE}/v1/defi/orderbook?address=${mintAddress}&limit=${limit}`, {
        headers: this.headers(),
        signal:  AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = (await res.json()) as { data: { buys: OrderLevel[]; sells: OrderLevel[] } };
        return { bids: data.data.buys, asks: data.data.sells };
      }
    }
    return this.synthesizeFromPrice(mintAddress, limit);
  }

  private async synthesizeFromPrice(
    mintAddress: string,
    limit: number,
  ): Promise<{ bids: OrderLevel[]; asks: OrderLevel[] }> {
    const price = await this.getTokenPrice(mintAddress);
    const step  = price * 0.00015;

    const makeLevel = (p: number): OrderLevel => ({
      price: p,
      size:  parseFloat((Math.random() * 150 + 5).toFixed(2)),
      total: 0,
    });

    const asks = Array.from({ length: limit }, (_, i) => makeLevel(+(price + (i + 1) * step).toFixed(4)));
    const bids = Array.from({ length: limit }, (_, i) => makeLevel(+(price - (i + 1) * step).toFixed(4)));

    let t = 0;
    for (const a of asks) { t += a.size; a.total = +t.toFixed(2); }
    t = 0;
    for (const b of bids) { t += b.size; b.total = +t.toFixed(2); }

    return { bids, asks };
  }
}
