import type { FastifyPluginAsync } from 'fastify';
import type { Candle } from '@repo/types';

const MOCK_MARKETS = [
  { id: '1', symbol: 'SOL-PERP', baseToken: 'SOL', quoteToken: 'USDC', type: 'perp', price: 145.20, change24h: 2.45, volume24h: 2_400_000_000, openInterest: 842_000_000, fundingRate: 0.0100 },
  { id: '2', symbol: 'BTC-PERP', baseToken: 'BTC', quoteToken: 'USDC', type: 'perp', price: 67_420.00, change24h: -0.82, volume24h: 8_200_000_000, openInterest: 3_100_000_000, fundingRate: 0.0050 },
  { id: '3', symbol: 'ETH-PERP', baseToken: 'ETH', quoteToken: 'USDC', type: 'perp', price: 3_512.40, change24h: 1.23, volume24h: 4_100_000_000, openInterest: 1_800_000_000, fundingRate: 0.0080 },
];

function generateCandles(basePrice: number, count = 50): Candle[] {
  const candles: Candle[] = [];
  let price = basePrice;
  const now = Date.now();
  for (let i = count; i >= 0; i--) {
    const change = (Math.random() - 0.48) * price * 0.02;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    candles.push({ time: Math.floor((now - i * 14_400_000) / 1000), open, high, low, close, volume: Math.random() * 1_000_000 });
    price = close;
  }
  return candles;
}

export const marketRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/markets', async (_req, reply) => reply.send({ markets: MOCK_MARKETS }));

  fastify.get<{ Params: { symbol: string } }>('/markets/:symbol/candles', async (request, reply) => {
    const market = MOCK_MARKETS.find((m) => m.symbol === request.params.symbol);
    if (!market) return reply.code(404).send({ error: 'Market not found' });
    return reply.send({ candles: generateCandles(market.price) });
  });

  fastify.get<{ Params: { symbol: string } }>('/markets/:symbol/orderbook', async (request, reply) => {
    const market = MOCK_MARKETS.find((m) => m.symbol === request.params.symbol);
    if (!market) return reply.code(404).send({ error: 'Market not found' });
    const mid = market.price;
    const asks = Array.from({ length: 10 }, (_, i) => ({ price: mid + (i + 1) * 0.05, size: Math.random() * 100 + 5, total: 0 }));
    const bids = Array.from({ length: 10 }, (_, i) => ({ price: mid - (i + 1) * 0.05, size: Math.random() * 100 + 5, total: 0 }));
    let total = 0;
    for (const ask of asks) { total += ask.size; ask.total = total; }
    total = 0;
    for (const bid of bids) { total += bid.size; bid.total = total; }
    return reply.send({ market: request.params.symbol, asks, bids, timestamp: Date.now() });
  });
};
