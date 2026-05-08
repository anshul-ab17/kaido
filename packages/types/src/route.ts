export type RouteVenue = 'jupiter' | 'orca' | 'openbook' | 'meteora' | 'drift';

export interface RouteStep {
  venue: RouteVenue;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  fee: number;
}

export interface RouteRequest {
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  slippageBps: number;
  walletAddress?: string;
}

export interface RouteResult {
  steps: RouteStep[];
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  totalFee: number;
  confidenceScore: number;
  aiExplanation?: string;
  estimatedSavings: number;
  executionTimeMs: number;
}
