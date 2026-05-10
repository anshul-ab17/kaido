export class SolanaRpcClient {
  constructor(private rpcUrl = 'https://api.mainnet-beta.solana.com') {}

  private async rpc<T>(method: string, params: unknown[] = []): Promise<T> {
    const res = await fetch(this.rpcUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal:  AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`Solana RPC ${method} ${res.status}`);
    const data = (await res.json()) as { result: T };
    return data.result;
  }

  async getSlot(): Promise<number> {
    return this.rpc<number>('getSlot');
  }

  async getTps(): Promise<number> {
    const samples = await this.rpc<Array<{ numTransactions: number; samplePeriodSecs: number }>>(
      'getRecentPerformanceSamples',
      [1],
    );
    const s = samples[0];
    return s ? Math.round(s.numTransactions / s.samplePeriodSecs) : 0;
  }
}
