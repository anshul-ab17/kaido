import type { FastifyPluginAsync } from 'fastify';
import type { PredictionEvent } from '@repo/types';

const now = Date.now();
const DAY = 86_400_000;

const MOCK_EVENTS: PredictionEvent[] = [
  {
    id: 'evt-1',
    title: 'Will SOL exceed $200 by end of Q2 2026?',
    description: 'Resolves YES if SOL/USD closes above $200 on any major exchange on or before June 30, 2026.',
    category: 'Crypto',
    status: 'open',
    resolutionDate: now + 52 * DAY,
    yesPrice: 0.62,
    noPrice: 0.38,
    volume: 1_250_000,
    liquidity: 420_000,
    createdAt: now - 7 * DAY,
  },
  {
    id: 'evt-2',
    title: 'Will BTC reach $100k before June 2026?',
    description: 'Resolves YES if BTC/USD price hits $100,000 on any major exchange before June 1, 2026.',
    category: 'Crypto',
    status: 'open',
    resolutionDate: now + 23 * DAY,
    yesPrice: 0.71,
    noPrice: 0.29,
    volume: 3_400_000,
    liquidity: 1_200_000,
    createdAt: now - 14 * DAY,
  },
  {
    id: 'evt-3',
    title: 'Will ETH flip BNB by market cap in 2026?',
    description: 'Resolves YES if ETH market cap exceeds BNB at any point during 2026.',
    category: 'Crypto',
    status: 'open',
    resolutionDate: now + 235 * DAY,
    yesPrice: 0.88,
    noPrice: 0.12,
    volume: 560_000,
    liquidity: 180_000,
    createdAt: now - 3 * DAY,
  },
  {
    id: 'evt-4',
    title: 'Will the US approve a Solana ETF in 2026?',
    description: 'Resolves YES if the SEC approves a spot Solana ETF by December 31, 2026.',
    category: 'Regulation',
    status: 'open',
    resolutionDate: now + 235 * DAY,
    yesPrice: 0.45,
    noPrice: 0.55,
    volume: 2_100_000,
    liquidity: 750_000,
    createdAt: now - 21 * DAY,
  },
  {
    id: 'evt-5',
    title: 'Will Solana TPS exceed 100k sustained in 2026?',
    description: 'Resolves YES if Solana sustains >100k TPS for 1 hour on mainnet in 2026.',
    category: 'Technology',
    status: 'open',
    resolutionDate: now + 180 * DAY,
    yesPrice: 0.33,
    noPrice: 0.67,
    volume: 890_000,
    liquidity: 310_000,
    createdAt: now - 5 * DAY,
  },
  {
    id: 'evt-6',
    title: 'Will DeFi TVL exceed $200B by Q3 2026?',
    description: 'Resolves YES if total DeFi TVL across all chains exceeds $200B (per DeFiLlama) before September 30, 2026.',
    category: 'DeFi',
    status: 'open',
    resolutionDate: now + 144 * DAY,
    yesPrice: 0.54,
    noPrice: 0.46,
    volume: 1_750_000,
    liquidity: 620_000,
    createdAt: now - 10 * DAY,
  },
];

export const eventRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/events', async (_req, reply) => reply.send({ events: MOCK_EVENTS }));

  fastify.get<{ Params: { id: string } }>('/events/:id', async (request, reply) => {
    const event = MOCK_EVENTS.find((e) => e.id === request.params.id);
    if (!event) return reply.code(404).send({ error: 'Event not found' });
    return reply.send({ event });
  });
};
