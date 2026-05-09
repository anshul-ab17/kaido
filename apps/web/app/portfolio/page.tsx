'use client';

import { Component } from 'react';
import { Navbar } from '../../components/Navbar';
import { StatusBar } from '../../components/StatusBar';
import { Wallet, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Holding {
  symbol: string;
  amount: number;
  usdValue: number;
  change24h: number;
  avgPrice: number;
}

const MOCK_HOLDINGS: Holding[] = [
  { symbol: 'SOL', amount: 12.5, usdValue: 1815.0, change24h: 2.45, avgPrice: 142.15 },
  { symbol: 'USDC', amount: 1450.0, usdValue: 1450.0, change24h: 0.0, avgPrice: 1.0 },
  { symbol: 'BTC', amount: 0.021, usdValue: 1415.82, change24h: -0.82, avgPrice: 66_800.0 },
  { symbol: 'ETH', amount: 0.85, usdValue: 2985.54, change24h: 1.23, avgPrice: 3_510.0 },
];

type Tab = 'holdings' | 'positions' | 'history';

interface PortfolioState {
  tab: Tab;
  connected: boolean;
}

class PortfolioView extends Component<Record<string, never>, PortfolioState> {
  override state: PortfolioState = { tab: 'holdings', connected: false };

  private handleConnect = () => this.setState({ connected: true });

  private renderHoldings() {
    const total = MOCK_HOLDINGS.reduce((sum, h) => sum + h.usdValue, 0);
    const totalPnl = MOCK_HOLDINGS.reduce((sum, h) => sum + (h.usdValue * h.change24h) / 100, 0);

    return (
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card p-5">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Total Value</p>
            <p className="text-3xl font-bold font-mono">
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className={cn('text-xs font-mono mt-1', totalPnl >= 0 ? 'text-success' : 'text-error')}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} today
            </p>
          </div>
          <div className="glass-card p-5">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">24h PnL</p>
            <p className={cn('text-3xl font-bold font-mono', totalPnl >= 0 ? 'text-success' : 'text-error')}>
              {totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl).toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {((totalPnl / total) * 100).toFixed(2)}% change
            </p>
          </div>
          <div className="glass-card p-5">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Assets</p>
            <p className="text-3xl font-bold font-mono">{MOCK_HOLDINGS.length}</p>
            <p className="text-xs text-gray-500 mt-1">Across all chains</p>
          </div>
        </div>

        {/* Holdings table */}
        <div className="glass-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Asset</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Balance</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 hidden sm:table-cell">Avg Cost</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Value</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">24h</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 hidden md:table-cell">Allocation</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_HOLDINGS.map((h) => {
                const positive = h.change24h >= 0;
                const pct = ((h.usdValue / total) * 100).toFixed(1);
                return (
                  <tr key={h.symbol} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold">{h.symbol.slice(0, 3)}</span>
                        </div>
                        <div>
                          <div className="text-sm font-bold">{h.symbol}</div>
                          <div className="text-[10px] text-gray-500">{h.amount.toLocaleString()} {h.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-mono">{h.amount.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                      <span className="text-xs font-mono text-gray-400">
                        ${h.avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-mono font-bold">
                        ${h.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={cn(
                        'text-xs font-mono font-bold inline-flex items-center justify-end gap-0.5',
                        positive ? 'text-success' : 'text-error'
                      )}>
                        {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {positive ? '+' : ''}{h.change24h.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/50 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-gray-500 w-10 text-right">{pct}%</span>
                      </div>
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

  override render() {
    const { tab, connected } = this.state;

    if (!connected) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold font-heading mb-2">Connect Your Wallet</h2>
            <p className="text-sm text-gray-500">Connect your Solana wallet to view your portfolio</p>
          </div>
          <button
            onClick={this.handleConnect}
            className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:brightness-110 transition-all glow-crimson"
          >
            Connect Wallet
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">Portfolio</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your holdings and performance</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 gap-6">
          {(['holdings', 'positions', 'history'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => this.setState({ tab: t })}
              className={cn(
                'pb-3 text-sm font-semibold capitalize transition-colors relative',
                tab === t ? 'text-white' : 'text-gray-500 hover:text-white'
              )}
            >
              {t}
              {tab === t && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />}
            </button>
          ))}
        </div>

        {tab === 'holdings' && this.renderHoldings()}

        {tab === 'positions' && (
          <div className="glass-card flex flex-col items-center justify-center py-16 gap-3">
            <Activity className="w-8 h-8 text-gray-700" />
            <p className="font-mono text-xs uppercase tracking-widest font-bold text-gray-600">No open positions</p>
            <p className="text-[11px] text-gray-700">Start trading to see your positions here</p>
          </div>
        )}

        {tab === 'history' && (
          <div className="glass-card flex flex-col items-center justify-center py-16 gap-3">
            <Activity className="w-8 h-8 text-gray-700" />
            <p className="font-mono text-xs uppercase tracking-widest font-bold text-gray-600">No trade history</p>
            <p className="text-[11px] text-gray-700">Your completed trades will appear here</p>
          </div>
        )}
      </div>
    );
  }
}

export default function PortfolioPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-hide">
        <div className="max-w-7xl mx-auto">
          <PortfolioView />
        </div>
      </main>
      <StatusBar />
    </div>
  );
}
