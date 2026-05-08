import type { Ticker } from '@repo/types';

export interface PythConfig {
  connectionUrl: string;
}

// — Phase 2 will integrate Pyth Network
export class PythClient {
  private connectionUrl: string;
  private subscriptions = new Map<string, (ticker: Ticker) => void>();

  constructor(config: PythConfig) {
    this.connectionUrl = config.connectionUrl;
  }

  async getPrice(_symbol: string): Promise<number> {
    throw new Error('PythClient.getPrice not implemented — Phase 2');
  }

  subscribe(_symbol: string, _callback: (ticker: Ticker) => void): void {
    throw new Error('PythClient.subscribe not implemented — Phase 2');
  }

  unsubscribe(symbol: string): void {
    this.subscriptions.delete(symbol);
  }
}
