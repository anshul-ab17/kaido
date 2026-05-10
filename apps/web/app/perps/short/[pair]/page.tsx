'use client';

import { use } from 'react';
import { TradingTerminal } from '../../_terminal';

export default function ShortPairPage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = use(params);
  return <TradingTerminal defaultSide="short" pair={pair} />;
}
