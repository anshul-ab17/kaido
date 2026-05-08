export type EventOutcome = 'yes' | 'no';
export type EventStatus = 'open' | 'resolved' | 'cancelled';

export interface PredictionEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  status: EventStatus;
  resolutionDate: number;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  createdAt: number;
}

export interface EventMarket {
  eventId: string;
  outcome: EventOutcome;
  price: number;
  size: number;
  walletAddress: string;
}
