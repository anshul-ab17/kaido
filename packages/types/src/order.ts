export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus = 'open' | 'filled' | 'cancelled' | 'partial';

export interface Order {
  id: string;
  market: string;
  side: OrderSide;
  type: OrderType;
  price?: number;
  size: number;
  filled: number;
  status: OrderStatus;
  createdAt: number;
  walletAddress: string;
}

export interface Trade {
  id: string;
  market: string;
  side: OrderSide;
  price: number;
  size: number;
  fee: number;
  signature: string;
  timestamp: number;
  walletAddress: string;
}

export interface OrderbookLevel {
  price: number;
  size: number;
  total: number;
}

export interface Orderbook {
  market: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  timestamp: number;
}
