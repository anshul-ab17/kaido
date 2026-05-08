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

export interface WsMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong' | 'data' | 'error';
  payload?: WsSubscription | WsTick;
  error?: string;
}
