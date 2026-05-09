'use client';

import { Component } from 'react';
import type { Market } from '@repo/types';
import { Navbar } from '../../components/Navbar';
import { StatusBar } from '../../components/StatusBar';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface MarketsState {
  markets: Market[];
  loading: boolean;
  filter: 'all' | 'perp' | 'spot' | 'prediction';
  sort: 'volume' | 'change' | 'price';
}

class MarketsView extends Component<Record<string, never>, MarketsState> {
  override state: MarketsState = { markets: [], loading: true, filter: 'all', sort: 'volume' };

  override componentDidMount() {
    void fetch(`${API_URL}/markets`)
      .then((r) => r.json() as Promise<{ markets: Market[] }>)
      .then((data) => this.setState({ markets: data.markets, loading: false }))
      .catch(() => this.setState({ loading: false }));
  }

  override render() {
    const { markets, loading, filter, sort } = this.state;

    let filtered = filter === 'all' ? markets : markets.filter((m) => m.type === filter);
    if (sort === 'volume') filtered = [...filtered].sort((a, b) => b.volume24h - a.volume24h);
    else if (sort === 'change') filtered = [...filtered].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));
    else filtered = [...filtered].sort((a, b) => b.price - a.price);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading">Markets</h1>
            <p className="text-sm text-gray-500 mt-0.5">All trading pairs on Kaido</p>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-success" />
            <span className="text-xs font-mono text-success">LIVE</span>
          </div>
        </div>

        {/* Filters + sort */}
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'perp', 'spot', 'prediction'] as const).map((f) => (
            <button
              key={f}
              onClick={() => this.setState({ filter: f })}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize',
                filter === f ? 'bg-primary text-white glow-crimson' : 'glass text-gray-400 hover:text-white'
              )}
            >
              {f}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort:</span>
            {(['volume', 'change', 'price'] as const).map((s) => (
              <button
                key={s}
                onClick={() => this.setState({ sort: s })}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all capitalize',
                  sort === s ? 'text-white bg-white/10' : 'text-gray-500 hover:text-white'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Market</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Price</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">24h Change</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 hidden sm:table-cell">Volume 24h</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 hidden md:table-cell">Open Interest</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 hidden lg:table-cell">Funding</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Type</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5 animate-pulse">
                      <td className="px-4 py-4"><div className="h-4 bg-white/5 rounded w-24" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-white/5 rounded w-20 ml-auto" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-white/5 rounded w-16 ml-auto" /></td>
                      <td className="px-4 py-4 hidden sm:table-cell"><div className="h-4 bg-white/5 rounded w-24 ml-auto" /></td>
                      <td className="px-4 py-4 hidden md:table-cell"><div className="h-4 bg-white/5 rounded w-20 ml-auto" /></td>
                      <td className="px-4 py-4 hidden lg:table-cell"><div className="h-4 bg-white/5 rounded w-16 ml-auto" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-white/5 rounded w-12 ml-auto" /></td>
                    </tr>
                  ))
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-600 text-sm">
                        No markets found
                      </td>
                    </tr>
                  )
                  : filtered.map((market) => {
                      const positive = market.change24h >= 0;
                      return (
                        <tr
                          key={market.id}
                          className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold">{market.baseToken.slice(0, 3)}</span>
                              </div>
                              <div>
                                <div className="text-sm font-bold">{market.symbol}</div>
                                <div className="text-[10px] text-gray-500">{market.baseToken}/{market.quoteToken}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="font-mono text-sm font-bold">
                              ${market.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className={cn(
                              'inline-flex items-center gap-1 text-xs font-bold font-mono',
                              positive ? 'text-success' : 'text-error'
                            )}>
                              {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {positive ? '+' : ''}{market.change24h.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                            <span className="text-xs font-mono text-gray-400">
                              ${(market.volume24h / 1e9).toFixed(2)}B
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right hidden md:table-cell">
                            <span className="text-xs font-mono text-gray-400">
                              {market.openInterest !== undefined
                                ? `$${(market.openInterest / 1e9).toFixed(2)}B`
                                : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                            <span className={cn(
                              'text-xs font-mono',
                              (market.fundingRate ?? 0) >= 0 ? 'text-success' : 'text-error'
                            )}>
                              {market.fundingRate !== undefined
                                ? `${(market.fundingRate * 100).toFixed(4)}%`
                                : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className={cn(
                              'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                              market.type === 'perp'
                                ? 'bg-primary/15 text-primary'
                                : market.type === 'spot'
                                  ? 'bg-accent/15 text-accent'
                                  : 'bg-success/15 text-success'
                            )}>
                              {market.type}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

export default function MarketsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-hide">
        <div className="max-w-7xl mx-auto">
          <MarketsView />
        </div>
      </main>
      <StatusBar />
    </div>
  );
}
