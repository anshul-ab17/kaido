import type { FastifyPluginAsync } from 'fastify';

const BINANCE_URL = 'https://api.binance.com/api/v3/klines';

const MARKET_CONFIG = [
  { id: '1', symbol: 'SOL-PERP', baseToken: 'SOL', quoteToken: 'USDC', type: 'perp', binanceSymbol: 'SOLUSDT', birdeyeMint: 'So11111111111111111111111111111111111111112' },
  { id: '2', symbol: 'BTC-PERP', baseToken: 'BTC', quoteToken: 'USDC', type: 'perp', binanceSymbol: 'BTCUSDT', birdeyeMint: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh' },
  { id: '3', symbol: 'ETH-PERP', baseToken: 'ETH', quoteToken: 'USDC', type: 'perp', binanceSymbol: 'ETHUSDT', birdeyeMint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs' },
  { id: '4', symbol: 'SOL/USDC', baseToken: 'SOL', quoteToken: 'USDC', type: 'spot', binanceSymbol: 'SOLUSDT', birdeyeMint: 'So11111111111111111111111111111111111111112' },
  { id: '5', symbol: 'BTC/USDC', baseToken: 'BTC', quoteToken: 'USDC', type: 'spot', binanceSymbol: 'BTCUSDT', birdeyeMint: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh' },
  { id: '6', symbol: 'ETH/USDC', baseToken: 'ETH', quoteToken: 'USDC', type: 'spot', binanceSymbol: 'ETHUSDT', birdeyeMint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs' },
  { id: '7', symbol: 'JUP/USDC', baseToken: 'JUP', quoteToken: 'USDC', type: 'spot', binanceSymbol: null,       birdeyeMint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { id: '8', symbol: 'RAY/USDC', baseToken: 'RAY', quoteToken: 'USDC', type: 'spot', binanceSymbol: null,       birdeyeMint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
] as const;

const BINANCE_TF: Record<string, string> = {
  '1m': '1m', '5m': '5m', '15m': '15m',
  '1H': '1h', '4H': '4h', '1D': '1d', '1W': '1w',
};

const BINANCE_LIMIT: Record<string, number> = {
  '1m': 300, '5m': 400, '15m': 400,
  '1H': 500, '4H': 500, '1D': 365, '1W': 104,
};

export const marketRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /markets — live Pyth prices
  fastify.get('/markets', async (_req, reply) => {
    const prices = await fastify.sdk.pyth.getPrices().catch(() => ({} as Record<string, number>));

    const markets = MARKET_CONFIG.map((m) => {
      const perpSymbol = `${m.baseToken}-PERP`;
      const price = prices[perpSymbol] ?? prices[m.symbol] ?? 0;
      return {
        id:           m.id,
        symbol:       m.symbol,
        baseToken:    m.baseToken,
        quoteToken:   m.quoteToken,
        type:         m.type,
        price,
        change24h:    0,
        volume24h:    0,
        openInterest: m.type === 'perp' ? 0 : undefined,
        fundingRate:  m.type === 'perp' ? 0 : undefined,
      };
    });

    return reply.send({ markets });
  });

  // GET /markets/:symbol/candles — Binance OHLCV
  fastify.get<{ Params: { symbol: string }; Querystring: { timeframe?: string } }>(
    '/markets/:symbol/candles',
    async (request, reply) => {
      const cfg = MARKET_CONFIG.find((m) => m.symbol === request.params.symbol);
      if (!cfg) return reply.code(404).send({ error: 'Market not found' });

      const tf    = request.query.timeframe ?? '1H';
      const binTf = BINANCE_TF[tf] ?? '1h';
      const limit = BINANCE_LIMIT[tf] ?? 500;

      if (cfg.binanceSymbol) {
        const res = await fetch(
          `${BINANCE_URL}?symbol=${cfg.binanceSymbol}&interval=${binTf}&limit=${limit}`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (!res.ok) return reply.code(502).send({ error: `Binance ${res.status}` });

        const raw = (await res.json()) as [number, string, string, string, string, string][];
        const candles = raw.map((k) => ({
          time:   Math.floor(k[0] / 1000),
          open:   parseFloat(k[1]),
          high:   parseFloat(k[2]),
          low:    parseFloat(k[3]),
          close:  parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }));
        return reply.send({ candles, timeframe: tf });
      }

      // Tokens without Binance listing: use Birdeye price + empty candles
      return reply.send({ candles: [], timeframe: tf });
    },
  );

  // GET /markets/:symbol/orderbook — synthesised from Pyth mid-price (Birdeye pro optional)
  fastify.get<{ Params: { symbol: string } }>(
    '/markets/:symbol/orderbook',
    async (request, reply) => {
      const cfg = MARKET_CONFIG.find((m) => m.symbol === request.params.symbol);
      if (!cfg) return reply.code(404).send({ error: 'Market not found' });

      // Try Birdeye first; always fall back to local synthesis
      try {
        const book = await fastify.sdk.birdeye.getOrderbook(cfg.birdeyeMint, 14);
        return reply.send({ market: request.params.symbol, asks: book.asks, bids: book.bids, timestamp: Date.now() });
      } catch { /* fall through to Pyth synthesis */ }

      // Deterministic book from Pyth mid (no RNG) when Birdeye fails
      const prices  = await fastify.sdk.pyth.getPrices().catch(() => ({} as Record<string, number>));
      const perpKey = `${cfg.baseToken}-PERP`;
      const mid     = prices[perpKey] ?? prices[cfg.symbol] ?? 1;
      const step    = mid * 0.00015;
      const LEVELS  = 14;
      const sym     = request.params.symbol;

      const levelSize = (side: 'ask' | 'bid', i: number) => {
        let h = 0;
        const seed = `${sym}:${cfg.birdeyeMint}:${side}:${i}`;
        for (let j = 0; j < seed.length; j++) h = (h * 31 + seed.charCodeAt(j)) >>> 0;
        return +((5 + (h % 10_000) / 100).toFixed(2));
      };

      const asks = Array.from({ length: LEVELS }, (_, i) => ({
        price: parseFloat((mid + (i + 1) * step).toFixed(4)),
        size:  levelSize('ask', i),
        total: 0,
      }));
      const bids = Array.from({ length: LEVELS }, (_, i) => ({
        price: parseFloat((mid - (i + 1) * step).toFixed(4)),
        size:  levelSize('bid', i),
        total: 0,
      }));

      let t = 0;
      for (const a of asks) { t += a.size; a.total = +t.toFixed(2); }
      t = 0;
      for (const b of bids) { t += b.size; b.total = +t.toFixed(2); }

      return reply.send({ market: request.params.symbol, asks, bids, timestamp: Date.now() });
    },
  );

  // GET /markets/:symbol/funding — Drift funding rates
  fastify.get<{ Params: { symbol: string } }>(
    '/markets/:symbol/funding',
    async (request, reply) => {
      const cfg = MARKET_CONFIG.find((m) => m.symbol === request.params.symbol);
      if (!cfg || cfg.type !== 'perp') return reply.code(404).send({ error: 'Perp market not found' });

      const rates = await fastify.sdk.drift.getFundingRates();
      const rate  = rates.find((r) => r.market === request.params.symbol);
      if (!rate) return reply.code(503).send({ error: 'Funding rate unavailable' });

      return reply.send({
        symbol:      request.params.symbol,
        currentRate: rate.rate,
        annualized:  rate.annualized,
        direction:   rate.direction,
        history:     [],
      });
    },
  );
};
