'use client';

import { use } from 'react';
import { TradingTerminal } from '../../_terminal';

export default function LongPairPage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = use(params);
  return <TradingTerminal defaultSide="long" pair={pair} />;
}
