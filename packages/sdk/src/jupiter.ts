import type { RouteRequest, RouteResult } from '@repo/types';

export interface JupiterConfig {
  apiUrl: string;
}

// Stub — Phase 2 will integrate Jupiter Quote API
export class JupiterClient {
  private apiUrl: string;

  constructor(config: JupiterConfig) {
    this.apiUrl = config.apiUrl;
  }

  async getQuote(_request: RouteRequest): Promise<RouteResult> {
    throw new Error('JupiterClient.getQuote not implemented — Phase 2');
  }

  async buildSwapTransaction(
    _routeResult: RouteResult,
    _walletAddress: string
  ): Promise<Uint8Array> {
    throw new Error('JupiterClient.buildSwapTransaction not implemented — Phase 2');
  }
}
