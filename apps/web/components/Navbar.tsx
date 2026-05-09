'use client';

import { Component } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, Zap, ChevronDown, Bell, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { Badge } from '@repo/ui/badge';
import { useKaidoStore } from '../store';

interface NavItem {
  label: string;
  href: string;
  hot?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Markets', href: '/markets' },
  { label: 'Perps', href: '/', hot: true },
  { label: 'Events', href: '/events' },
  { label: 'Predict', href: '/events' },
  { label: 'Portfolio', href: '/portfolio' },
];

const MORE_ITEMS = ['Insights', 'Liquidity', 'Whales', 'Analytics', 'AI Copilot', 'Stake', 'Watchlist'];

function NavLinks({ moreOpen, onToggleMore }: { moreOpen: boolean; onToggleMore: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="hidden md:flex items-center gap-1 relative">
      {NAV_ITEMS.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={`${item.label}-${item.href}`}
            href={item.href}
            className={cn(
              'relative px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              active ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
          >
            {item.label}
            {item.hot && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
            )}
            {active && (
              <div className="absolute bottom-[-14px] left-0 right-0 h-[2px] bg-primary glow-crimson" />
            )}
          </Link>
        );
      })}

      <div className="relative">
        <button
          onClick={onToggleMore}
          className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-gray-400 hover:text-white transition-all"
        >
          More <ChevronDown className={cn('w-3 h-3 transition-transform', moreOpen && 'rotate-180')} />
        </button>
        {moreOpen && (
          <div className="absolute top-full left-0 mt-2 w-40 glass rounded-xl border border-white/10 py-1 z-50">
            {MORE_ITEMS.map((item) => (
              <button
                key={item}
                className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

function NavCenterStats() {
  const tickers = useKaidoStore((s) => s.tickers);
  const solPrice = tickers['SOL-PERP']?.price ?? 145.20;
  return (
    <div className="hidden lg:flex items-center gap-6 px-5 py-1.5 bg-black/40 rounded-full border border-white/5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-gray-500 uppercase">SOL</span>
        <span className="text-xs font-bold text-success">${solPrice.toFixed(2)}</span>
      </div>
      <div className="w-px h-3 bg-white/10" />
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-gray-500 uppercase">TPS</span>
        <span className="text-xs font-bold text-accent">2,842</span>
      </div>
      <div className="w-px h-3 bg-white/10" />
      <Badge variant="success" pulse>LIVE</Badge>
    </div>
  );
}

interface NavbarState {
  moreOpen: boolean;
  walletConnecting: boolean;
}

export class Navbar extends Component<Record<string, never>, NavbarState> {
  override state: NavbarState = { moreOpen: false, walletConnecting: false };

  private toggleMore = () => this.setState((s) => ({ moreOpen: !s.moreOpen }));

  private handleConnect = () => {
    this.setState({ walletConnecting: true });
    setTimeout(() => this.setState({ walletConnecting: false }), 1500);
  };

  override render() {
    const { moreOpen, walletConnecting } = this.state;
    return (
      <header className="h-14 border-b border-white/5 glass flex items-center justify-between px-6 z-50 sticky top-0">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 cursor-pointer group">
            <div className="w-7 h-7 bg-primary rounded flex items-center justify-center glow-crimson transition-transform group-hover:scale-110">
              <Zap className="text-white w-4 h-4 fill-white" />
            </div>
            <span className="text-lg font-bold tracking-tighter uppercase font-heading">Kaido</span>
          </Link>
          <NavLinks moreOpen={moreOpen} onToggleMore={this.toggleMore} />
        </div>

        <NavCenterStats />

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-gray-400">
            <button className="p-2 hover:text-white transition-colors"><Bell className="w-4 h-4" /></button>
            <button className="p-2 hover:text-white transition-colors"><Settings className="w-4 h-4" /></button>
          </div>
          <button
            onClick={this.handleConnect}
            disabled={walletConnecting}
            className="bg-primary text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all glow-crimson disabled:opacity-70"
          >
            {walletConnecting
              ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Wallet className="w-3.5 h-3.5" />}
            {walletConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      </header>
    );
  }
}
