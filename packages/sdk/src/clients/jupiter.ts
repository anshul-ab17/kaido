import type { JupiterQuote, SolanaCluster } from '../types.js';

const BASE = 'https://quote-api.jup.ag/v6';

/** Mainnet SPL mints (production). */
export const MAINNET_MINTS: Record<string, string> = {
  SOL:  'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  BTC:  '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
  ETH:  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
  JUP:  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  RAY:  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
};

/**
 * Devnet mints — SOL/native mint is unchanged; USDC is the common devnet SPL.
 * Other symbols reuse mainnet mints where Jupiter has no devnet listing (quotes may fail).
 */
export const DEVNET_MINTS: Record<string, string> = {
  ...MAINNET_MINTS,
  USDC: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
};

export const DECIMALS: Record<string, number> = {
  SOL: 9, USDC: 6, BTC: 8, ETH: 8, JUP: 6, RAY: 6, BONK: 5,
};

export class JupiterClient {
  private mints: Record<string, string>;
  private cluster: SolanaCluster;

  constructor(cluster: SolanaCluster = 'devnet') {
    this.cluster = cluster;
    this.mints    = cluster === 'devnet' ? DEVNET_MINTS : MAINNET_MINTS;
  }

  getMints(): Record<string, string> {
    return this.mints;
  }

  getDecimals(): Record<string, number> {
    return DECIMALS;
  }

  private clusterQs(): string {
    return this.cluster === 'devnet' ? '&cluster=devnet' : '';
  }

  async quote(params: {
    inputToken:  string;
    outputToken: string;
    inputAmount: number;
    slippageBps?: number;
  }): Promise<JupiterQuote & { outputAmount: number; priceImpact: number }> {
    const inMint  = this.mints[params.inputToken];
    const outMint = this.mints[params.outputToken];
    if (!inMint || !outMint) throw new Error(`Unknown token: ${params.inputToken} or ${params.outputToken}`);

    const decimals = DECIMALS[params.inputToken] ?? 9;
    const amtRaw   = Math.floor(params.inputAmount * 10 ** decimals);
    const url =
      `${BASE}/quote?inputMint=${inMint}&outputMint=${outMint}&amount=${amtRaw}&slippageBps=${params.slippageBps ?? 50}` +
      this.clusterQs();

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Jupiter quote ${res.status}: ${await res.text()}`);

    const q = (await res.json()) as JupiterQuote;
    const outDecimals = DECIMALS[params.outputToken] ?? 6;
    const outputAmount  = parseFloat(q.outAmount) / 10 ** outDecimals;
    const priceImpact   = parseFloat(q.priceImpactPct);
    return { ...q, outputAmount, priceImpact };
  }

  async buildSwap(
    quote: JupiterQuote,
    userPublicKey: string,
  ): Promise<{ transaction: string; encoding: 'base64' }> {
    const body: Record<string, unknown> = {
      quoteResponse:            quote,
      userPublicKey,
      wrapAndUnwrapSol:         true,
      dynamicComputeUnitLimit:  true,
      prioritizationFeeLamports: 'auto',
    };
    if (this.cluster === 'devnet') body['cluster'] = 'devnet';

    const res = await fetch(`${BASE}/swap`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Jupiter swap ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { swapTransaction: string };
    return { transaction: data.swapTransaction, encoding: 'base64' };
  }
}
