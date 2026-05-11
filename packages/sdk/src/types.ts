// Wallet asset returned by Helius DAS
export interface WalletAsset {
  symbol:   string;
  amount:   number;
  usdValue: number;
  price:    number;
  change24h?: number;
}

// Orderbook level
export interface OrderLevel {
  price: number;
  size:  number;
  total: number;
}

// Liquidity pool from DeFiLlama
export interface Pool {
  id:        string;
  pair:      string;
  venue:     string;
  tvl:       number;
  apy:       number;
  volume24h: number;
  fee:       number;
}

// Whale transaction (large on-chain trade)
export interface WhaleTx {
  id:        string;
  type:      'buy' | 'sell' | 'transfer' | 'swap';
  asset:     string;
  amount:    number;
  usdValue:  number;
  venue:     string;
  from:      string;
  to:        string;
  signature: string;
  timestamp: string;
}

// Funding rate per perp market
export interface FundingRate {
  market:       string;
  rate:         number;   // per 8h
  annualized:   number;
  direction:    'long' | 'short';
  openInterest: number;
}

// Jupiter quote response shape (partial)
export interface JupiterQuote {
  outAmount:      string;
  priceImpactPct: string;
  routePlan:      unknown[];
  inputMint:      string;
  outputMint:     string;
  inAmount:       string;
}

export type SolanaCluster = 'mainnet-beta' | 'devnet';

// SDK config
export interface LogPoseConfig {
  cluster?:          SolanaCluster;
  heliusApiKey?:     string;
  birdeyeApiKey?:    string;
  rpcUrl?:           string;
  natsUrl?:          string;
  jupiterApiKey?:    string;
}
