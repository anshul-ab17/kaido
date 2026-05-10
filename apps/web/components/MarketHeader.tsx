'use client';

import { Component, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useKaidoStore } from '../store';
import { CoinIcon } from './CoinIcon';

const MARKETS = [
  'SOL-PERP', 'BTC-PERP', 'ETH-PERP',
  'BNB-PERP', 'ARB-PERP', 'JUP-PERP',
];

/* Updates browser tab title with live price */
function TabTitleUpdater() {
  const activeMarket = useKaidoStore((s) => s.activeMarket);
  const tickers      = useKaidoStore((s) => s.tickers);
  const price        = tickers[activeMarket]?.price;

  useEffect(() => {
    const base   = activeMarket.replace('-PERP', '');
    const priceStr = price ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
    document.title = priceStr ? `${base} ${priceStr} | Kaido` : `${base} | Kaido`;
  }, [activeMarket, price]);

  return null;
}

function MarketSelector() {
  const activeMarket    = useKaidoStore((s) => s.activeMarket);
  const setActiveMarket = useKaidoStore((s) => s.setActiveMarket);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/[0.04] rounded-xl transition-all border border-transparent hover:border-white/[0.07] active:scale-95"
      >
        <CoinIcon symbol={activeMarket} size={26} />
        <div className="flex flex-col items-start">
          <span className="font-black text-[14px] tracking-tight text-white leading-none">{activeMarket}</span>
          <span className="text-[9px] text-gray-600 leading-none mt-0.5">Perpetual</span>
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-gray-600 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[190]" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-52 bg-[#0c0210] border border-white/[0.07] rounded-2xl p-1.5 z-[200] shadow-[0_16px_48px_rgba(0,0,0,0.75)]">
            {MARKETS.map((m) => (
              <button
                key={m}
                onClick={() => { setActiveMarket(m); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-bold transition-all rounded-xl',
                  activeMarket === m
                    ? 'bg-primary/15 text-primary border border-primary/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.05]',
                )}
              >
                <CoinIcon symbol={m} size={22} />
                <span>{m}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LiveStats() {
  const tickers      = useKaidoStore((s) => s.tickers);
  const activeMarket = useKaidoStore((s) => s.activeMarket);
  const price        = tickers[activeMarket]?.price ?? 145.20;
  const change       = 2.45;

  const stats = [
    { label: 'Price',        value: `$${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, cls: 'text-white font-black text-[13px]' },
    { label: '24h Change',   value: `+${change.toFixed(2)}%`,  cls: 'text-success font-bold' },
    { label: 'Index',        value: `$${(price - 0.02).toFixed(2)}`, cls: 'text-gray-500 font-medium' },
    { label: '24h Volume',   value: '$2.4B',                   cls: 'text-gray-500 font-medium' },
    { label: 'Funding / 1h', value: '+0.0100%',                cls: 'text-success font-medium' },
  ];

  return (
    <div className="flex items-center gap-6 px-2">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col shrink-0">
          <span className="text-[9px] text-gray-700 font-bold uppercase tracking-[0.1em] leading-none mb-1">{s.label}</span>
          <span className={cn('text-[11px] font-mono leading-none tracking-tight', s.cls)}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

function WsStatusDot() {
  const wsStatus = useKaidoStore((s) => s.wsStatus);
  return (
    <div className="ml-auto flex items-center gap-2 px-4 shrink-0 border-l border-white/[0.04]">
      <div className={cn(
        'w-1.5 h-1.5 rounded-full',
        wsStatus === 'connected'  ? 'bg-success animate-pulse' :
        wsStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-700',
      )} />
      <span className={cn(
        'text-[9px] font-bold uppercase tracking-widest hidden sm:block',
        wsStatus === 'connected'  ? 'text-success' :
        wsStatus === 'connecting' ? 'text-yellow-500' : 'text-gray-700',
      )}>
        {wsStatus}
      </span>
    </div>
  );
}

export class MarketHeader extends Component {
  override render() {
    return (
      <>
        <TabTitleUpdater />
        <div className="h-14 flex items-center gap-2 px-4 border-b border-white/[0.04] bg-[#0e0307]/80 backdrop-blur-md shrink-0 overflow-x-auto scrollbar-hide">
          <MarketSelector />
          <div className="w-px h-6 bg-white/[0.06] mx-1 shrink-0" />
          <LiveStats />
          <WsStatusDot />
        </div>
      </>
    );
  }
}
