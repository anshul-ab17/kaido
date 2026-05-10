import type { Pool } from '../types.js';

interface LlamaPool {
  pool:        string;
  chain:       string;
  project:     string;
  symbol:      string;
  tvlUsd:      number;
  apy:         number | null;
  volumeUsd1d: number | null;
  fee:         number | null;
}

interface LlamaChain {
  name: string;
  tvl:  number;
}

export class DeFiLlamaClient {
  async getSolanaPools(limit = 20): Promise<Pool[]> {
    const res = await fetch('https://yields.llama.fi/pools', {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`DeFiLlama pools ${res.status}`);
    const data = (await res.json()) as { data: LlamaPool[] };

    return data.data
      .filter((p) => p.chain === 'Solana' && p.tvlUsd > 500_000)
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, limit)
      .map((p) => ({
        id:        p.pool,
        pair:      p.symbol,
        venue:     p.project,
        tvl:       p.tvlUsd,
        apy:       p.apy ?? 0,
        volume24h: p.volumeUsd1d ?? 0,
        fee:       (p.fee ?? 0) / 100,
      }));
  }

  async getSolanaTvl(): Promise<number> {
    const res = await fetch('https://api.llama.fi/v2/chains', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`DeFiLlama chains ${res.status}`);
    const chains = (await res.json()) as LlamaChain[];
    return chains.find((c) => c.name === 'Solana')?.tvl ?? 0;
  }
}
