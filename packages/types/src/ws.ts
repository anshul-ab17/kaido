export type WsChannel = 'ticker' | 'orderbook' | 'trades' | 'candles';

export interface WsSubscription {
  channel: WsChannel;
  symbol: string;
  timeframe?: string;
}

export interface WsTick {
  channel: WsChannel;
  symbol: string;
  data: unknown;
  timestamp: number;
}

export type WsMessage =
  | { type: 'subscribe'; payload: WsSubscription }
  | { type: 'unsubscribe'; payload: WsSubscription }
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'data'; payload: WsTick }
  | { type: 'error'; error: string };
