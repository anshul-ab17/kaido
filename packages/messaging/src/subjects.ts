export const SUBJECTS = {
  TICKS: 'kaido.ticks.>',
  TICK: (symbol: string) => `kaido.ticks.${symbol}`,
  TRADES: 'kaido.trades',
  EVENTS_BET: 'kaido.events.bet',
  POSITIONS: 'kaido.positions.>',
} as const;
