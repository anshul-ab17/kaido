import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  console.log(`Seeded ${markets.length} markets`);
}

main().catch(console.error).finally(() => void prisma.$disconnect());
