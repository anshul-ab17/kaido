'use client';

import { Component } from 'react';
import { Navbar } from '../../components/Navbar';
import { Activity, TrendingUp, TrendingDown, Droplets, BarChart2, ArrowUpRight, ArrowDownRight, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CoinIcon } from '../../components/CoinIcon';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface GlobalStats {
  totalVolume24h: number;
  totalTvl: number;
  activeTraders: number;
  tps: number;
  slot: number;
}

interface WhaleEvent {
  id: string;
  type: 'buy' | 'sell' | 'transfer' | 'liquidation';
  asset: string;
  amount: number;
  usdValue: number;
  venue: string;
  from: string;
  to: string;
  signature: string;
  timestamp: string;
}

interface LiquidityPool {
  name: string;
  venue: string;
  tvl: number;
  apy: number;
  volume24h: number;
  fee: number;
}

interface FundingRate {
  symbol: string;
  rate: number;
  annualized: number;
  openInterest: number;
  direction: 'longs-pay' | 'shorts-pay';
}

interface InsightsState {
  tab: 'whales' | 'liquidity' | 'funding';
  stats: GlobalStats | null;
  whales: WhaleEvent[];
  pools: LiquidityPool[];
  funding: FundingRate[];
  loading: boolean;
}

function fmt(n: number | undefined | null, decimals = 2) {
  if (n == null || isNaN(n)) return '$—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(decimals)}`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <p className="text-[10px] font-mono text-gray-500 uppercase mb-1">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-[11px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

class InsightsPage extends Component<Record<string, never>, InsightsState> {
  override state: InsightsState = {
    tab: 'whales',
    stats: null,
    whales: [],
    pools: [],
    funding: [],
    loading: true,
  };

  override async componentDidMount() {
    const [statsRes, whalesRes, poolsRes, fundingRes] = await Promise.allSettled([
      fetch(`${API_URL}/insights/stats`).then((r) => r.json()),
      fetch(`${API_URL}/insights/whales?limit=20`).then((r) => r.json()),
      fetch(`${API_URL}/insights/liquidity`).then((r) => r.json()),
      fetch(`${API_URL}/insights/funding`).then((r) => r.json()),
    ]);
    this.setState({
      stats: statsRes.status === 'fulfilled' ? (statsRes.value as GlobalStats) : null,
      whales: whalesRes.status === 'fulfilled' ? (whalesRes.value as WhaleEvent[]) : [],
      pools: poolsRes.status === 'fulfilled' ? (poolsRes.value as LiquidityPool[]) : [],
      funding: fundingRes.status === 'fulfilled' ? (fundingRes.value as FundingRate[]) : [],
      loading: false,
    });
  }

  private renderWhales() {
    const { whales } = this.state;
    if (!whales.length) return <p className="text-gray-600 text-sm text-center py-12">No whale activity found.</p>;

    const typeColor: Record<string, string> = {
      buy: 'text-success',
      sell: 'text-error',
      transfer: 'text-accent',
      liquidation: 'text-warning',
    };
    const TypeIcon = ({ type }: { type: string }) =>
      type === 'buy' || type === 'transfer'
        ? <ArrowUpRight className={cn('w-3.5 h-3.5', typeColor[type])} />
        : <ArrowDownRight className={cn('w-3.5 h-3.5', typeColor[type])} />;

    return (
      <div className="space-y-1">
        {whales.map((w) => (
          <div key={w.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06] hover:border-primary/[0.12] hover:bg-white/[0.02] transition-all">
            <TypeIcon type={w.type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn('text-xs font-bold uppercase', typeColor[w.type])}>{w.type}</span>
                <CoinIcon symbol={w.asset} size={16} />
                <span className="text-xs font-mono text-white">{w.amount.toLocaleString()} {w.asset}</span>
                <span className="text-xs text-gray-500">{fmt(w.usdValue)}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-gray-600">{w.venue}</span>
                <span className="text-[10px] text-gray-700">·</span>
                <span className="text-[10px] font-mono text-gray-600">{w.from.slice(0, 6)}…{w.from.slice(-4)}</span>
                <span className="text-[10px] text-gray-700">→</span>
                <span className="text-[10px] font-mono text-gray-600">{w.to.slice(0, 6)}…{w.to.slice(-4)}</span>
              </div>
            </div>
            <a
              href={`https://solscan.io/tx/${w.signature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-gray-700 hover:text-primary transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ))}
      </div>
    );
  }

  private renderLiquidity() {
    const { pools } = this.state;
    if (!pools.length) return <p className="text-gray-600 text-sm text-center py-12">No liquidity data found.</p>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-gray-600 uppercase border-b border-white/[0.06]">
              <th className="text-left py-2 px-4 font-mono">Pool</th>
              <th className="text-left py-2 px-4 font-mono">Venue</th>
              <th className="text-right py-2 px-4 font-mono">TVL</th>
              <th className="text-right py-2 px-4 font-mono">Vol 24h</th>
              <th className="text-right py-2 px-4 font-mono">APY</th>
              <th className="text-right py-2 px-4 font-mono">Fee</th>
            </tr>
          </thead>
          <tbody>
            {pools.map((p, i) => (
              <tr key={`${p.name}-${p.venue}-${i}`} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      <CoinIcon symbol={p.name.split('/')[0] ?? p.name} size={20} />
                      <CoinIcon symbol={p.name.split('/')[1] ?? ''} size={20} className="-ml-1.5" />
                    </div>
                    <span className="font-semibold text-white">{p.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-400">{p.venue}</td>
                <td className="py-3 px-4 text-right font-mono">{fmt(p.tvl)}</td>
                <td className="py-3 px-4 text-right font-mono text-gray-400">{fmt(p.volume24h)}</td>
                <td className="py-3 px-4 text-right font-mono text-success">{p.apy.toFixed(2)}%</td>
                <td className="py-3 px-4 text-right font-mono text-gray-500">{p.fee.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  private renderFunding() {
    const { funding } = this.state;
    if (!funding.length) return <p className="text-gray-600 text-sm text-center py-12">No funding data found.</p>;
    return (
      <div className="space-y-2">
        {funding.map((f) => (
          <div key={f.symbol} className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-white/[0.06] hover:border-primary/[0.10] transition-all">
            <div className="flex items-center gap-2 w-28">
              <CoinIcon symbol={f.symbol} size={20} />
              <span className="text-sm font-bold text-white">{f.symbol}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={cn('text-xs font-mono font-bold', f.rate >= 0 ? 'text-success' : 'text-error')}>
                  {f.rate >= 0 ? '+' : ''}{(f.rate * 100).toFixed(4)}%
                </span>
                <span className="text-[10px] text-gray-600">/ 8h</span>
                <span className="text-[10px] text-gray-600">
                  ({f.annualized >= 0 ? '+' : ''}{f.annualized.toFixed(2)}% ann.)
                </span>
              </div>
              <p className="text-[10px] text-gray-600 mt-0.5">{f.direction}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-mono text-gray-400">{fmt(f.openInterest)}</p>
              <p className="text-[10px] text-gray-600">OI</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  override render() {
    const { tab, stats, loading } = this.state;
    const TABS = [
      { id: 'whales' as const, label: 'Whale Tracker', icon: Activity },
      { id: 'liquidity' as const, label: 'Liquidity Pools', icon: Droplets },
      { id: 'funding' as const, label: 'Funding Rates', icon: BarChart2 },
    ];

    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold font-heading">Market Insights</h1>
            <p className="text-sm text-gray-500 mt-1">On-chain activity, liquidity, and funding data</p>
          </div>

          {/* Global Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="24h Volume" value={fmt(stats.totalVolume24h)} />
              <StatCard label="Total TVL" value={fmt(stats.totalTvl)} />
              <StatCard label="Active Traders" value={(stats.activeTraders ?? 0).toLocaleString()} />
              <StatCard label="TPS" value={(stats.tps ?? 0).toLocaleString()} sub={`Slot ${(stats.slot ?? 0).toLocaleString()}`} />
            </div>
          )}

          {/* Tabs */}
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="flex border-b border-white/[0.06]">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => this.setState({ tab: id })}
                  className={cn(
                    'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors',
                    tab === id ? 'text-white border-b-2 border-primary' : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <div className="p-4">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {tab === 'whales' && this.renderWhales()}
                  {tab === 'liquidity' && this.renderLiquidity()}
                  {tab === 'funding' && this.renderFunding()}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default function InsightsPageWrapper() {
  return <InsightsPage />;
}
