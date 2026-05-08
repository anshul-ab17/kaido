export type MarketType = 'spot' | 'perp' | 'prediction';
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export interface Market {
  id: string;
  symbol: string;
  baseToken: string;
  quoteToken: string;
  type: MarketType;
  price: number;
  change24h: number;
  volume24h: number;
  openInterest?: number;
  fundingRate?: number;
  indexPrice?: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Ticker {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}
