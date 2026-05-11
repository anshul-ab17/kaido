'use client';

/**
 * Shared trading terminal shell used by:
 *   /perps
 *   /perps/long/[pair]
 *   /perps/short/[pair]
 */

import { useEffect } from 'react';
import { Navbar } from '../../components/Navbar';
import { MarketHeader } from '../../components/MarketHeader';
import { TradingChart } from '../../components/TradingChart';
import { Orderbook } from '../../components/Orderbook';
import { TradeModule } from '../../components/TradeModule';
import { StatusBar } from '../../components/StatusBar';
import { PositionsPanel } from '../../components/PositionsPanel';
import { useKaidoStore } from '../../store';

type Side = 'long' | 'short';

// Map URL pair token → Zustand market symbol
const PAIR_TO_MARKET: Record<string, string> = {
  SOL:   'SOL-PERP',  WSOL:  'SOL-PERP',
  BTC:   'BTC-PERP',  WBTC:  'BTC-PERP',
  ETH:   'ETH-PERP',  WETH:  'ETH-PERP',
  BNB:   'BNB-PERP',
  ARB:   'ARB-PERP',
  JUP:   'JUP-PERP',
};

function resolveMarket(pair: string): string {
  // pair can be "SOL", "SOL-ETH", "SOL-WBTC" — base token is always first
  const base = pair.split('-')[0]?.toUpperCase() ?? 'SOL';
  return PAIR_TO_MARKET[base] ?? 'SOL-PERP';
}

function MarketSyncer({ pair }: { pair: string }) {
  const setActiveMarket = useKaidoStore((s) => s.setActiveMarket);
  useEffect(() => {
    setActiveMarket(resolveMarket(pair));
  }, [pair, setActiveMarket]);
  return null;
}

interface TerminalProps {
  defaultSide?: Side;
  pair?: string;
}

export function TradingTerminal({ defaultSide = 'long', pair = 'SOL' }: TerminalProps) {
  return (
    <div className="h-screen flex flex-col bg-background text-white overflow-hidden">
      <MarketSyncer pair={pair} />
      <Navbar />
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Area: Market Header + Trading View */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-primary/[0.08]">
          <MarketHeader />
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TradingChart />
            <PositionsPanel />
          </div>
        </div>

        {/* Right Area: Orderbook + Trade (Full height from market-info level) */}
        <div className="hidden xl:flex w-[200px] xl:w-[220px] shrink-0 border-r border-primary/[0.08] overflow-hidden flex-col">
          <Orderbook />
        </div>

        <div className="hidden lg:block w-[270px] xl:w-[290px] shrink-0 overflow-y-auto scrollbar-hide">
          <TradeModule defaultSide={defaultSide} />
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
