import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const LMSR_B = 1000;

function initLMSRqYes(yesPrice: number): number {
  const eY = yesPrice / (1 - yesPrice);
  return LMSR_B * Math.log(eY);
}

async function main() {
  const markets = [
    { symbol: 'SOL-PERP', baseToken: 'SOL', quoteToken: 'USDC', type: 'perp' },
    { symbol: 'BTC-PERP', baseToken: 'BTC', quoteToken: 'USDC', type: 'perp' },
    { symbol: 'ETH-PERP', baseToken: 'ETH', quoteToken: 'USDC', type: 'perp' },
    { symbol: 'SOL/USDC', baseToken: 'SOL', quoteToken: 'USDC', type: 'spot' },
    { symbol: 'BTC/USDC', baseToken: 'BTC', quoteToken: 'USDC', type: 'spot' },
    { symbol: 'ETH/USDC', baseToken: 'ETH', quoteToken: 'USDC', type: 'spot' },
    { symbol: 'JUP/USDC', baseToken: 'JUP', quoteToken: 'USDC', type: 'spot' },
    { symbol: 'RAY/USDC', baseToken: 'RAY', quoteToken: 'USDC', type: 'spot' },
  ];

  for (const m of markets) {
    await prisma.market.upsert({ where: { symbol: m.symbol }, update: {}, create: m });
  }

  const now = Date.now();
  const DAY = 86_400_000;

  const events = [
    {
      id: 'evt-1',
      title: 'Will SOL exceed $200 by end of Q2 2026?',
      description: 'Resolves YES if SOL/USD closes above $200 on any major exchange on or before June 30, 2026.',
      category: 'Crypto',
      resolutionDate: BigInt(now + 52 * DAY),
      qYes: initLMSRqYes(0.62),
      qNo: 0,
      volume: 0,
      liquidity: 1000,
    },
    {
      id: 'evt-2',
      title: 'Will BTC reach $100k before June 2026?',
      description: 'Resolves YES if BTC/USD price hits $100,000 on any major exchange before June 1, 2026.',
      category: 'Crypto',
      resolutionDate: BigInt(now + 23 * DAY),
      qYes: initLMSRqYes(0.71),
      qNo: 0,
      volume: 0,
      liquidity: 1000,
    },
    {
      id: 'evt-3',
      title: 'Will ETH flip BNB by market cap in 2026?',
      description: 'Resolves YES if ETH market cap exceeds BNB at any point during 2026.',
      category: 'Crypto',
      resolutionDate: BigInt(now + 235 * DAY),
      qYes: initLMSRqYes(0.88),
      qNo: 0,
      volume: 0,
      liquidity: 1000,
    },
    {
      id: 'evt-4',
      title: 'Will the US approve a Solana ETF in 2026?',
      description: 'Resolves YES if the SEC approves a spot Solana ETF by December 31, 2026.',
      category: 'Regulation',
      resolutionDate: BigInt(now + 235 * DAY),
      qYes: initLMSRqYes(0.45),
      qNo: 0,
      volume: 0,
      liquidity: 1000,
    },
    {
      id: 'evt-5',
      title: 'Will Solana TPS exceed 100k sustained in 2026?',
      description: 'Resolves YES if Solana sustains >100k TPS for 1 hour on mainnet in 2026.',
      category: 'Technology',
      resolutionDate: BigInt(now + 180 * DAY),
      qYes: initLMSRqYes(0.33),
      qNo: 0,
      volume: 0,
      liquidity: 1000,
    },
    {
      id: 'evt-6',
      title: 'Will DeFi TVL exceed $200B by Q3 2026?',
      description: 'Resolves YES if total DeFi TVL across all chains exceeds $200B (per DeFiLlama) before Sep 30, 2026.',
      category: 'DeFi',
      resolutionDate: BigInt(now + 144 * DAY),
      qYes: initLMSRqYes(0.54),
      qNo: 0,
      volume: 0,
      liquidity: 1000,
    },
  ];

  for (const e of events) {
    await prisma.event.upsert({ where: { id: e.id }, update: {}, create: e });
  }

  console.log(`Seeded ${markets.length} markets, ${events.length} events`);
}

main().catch(console.error).finally(() => void prisma.$disconnect());
