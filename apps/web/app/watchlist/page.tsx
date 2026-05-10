'use client';

import { Component } from 'react';
import { Navbar } from '../../components/Navbar';
import { Star, StarOff, TrendingUp, TrendingDown, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useKaidoStore } from '../../store';
import { CoinIcon } from '../../components/CoinIcon';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Ticker {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
}

interface Market {
  symbol: string;
  name: string;
  type: string;
}

interface WatchlistState {
  tickers: Record<string, Ticker>;
  markets: Market[];
  loading: boolean;
  addSearch: string;
  addOpen: boolean;
}

interface WatchlistProps {
  watchlist: string[];
  onRemove: (s: string) => void;
  onAdd: (s: string) => void;
}

class WatchlistView extends Component<WatchlistProps, WatchlistState> {
  override state: WatchlistState = {
    tickers: {},
    markets: [],
    loading: true,
    addSearch: '',
    addOpen: false,
  };

  override async componentDidMount() {
    try {
      const res  = await fetch(`${API_URL}/markets`);
      const data = (await res.json()) as { markets?: Market[] } | Market[];
      const mkts = Array.isArray(data) ? data : ((data as { markets?: Market[] }).markets ?? []);
      this.setState({ markets: mkts, loading: false });
    } catch {
      this.setState({ loading: false });
    }
  }

  private filteredMarkets() {
    const { markets, addSearch } = this.state;
    const { watchlist } = this.props;
    return markets.filter(
      (m) =>
        !watchlist.includes(m.symbol) &&
        m.symbol.toLowerCase().includes(addSearch.toLowerCase())
    );
  }

  override render() {
    const { watchlist, onRemove, onAdd } = this.props;
    const { tickers, loading, addSearch, addOpen, markets } = this.state;

    const watchedMarkets = markets.filter((m) => watchlist.includes(m.symbol));

    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold font-heading">Watchlist</h1>
              <p className="text-sm text-gray-500 mt-1">Track markets you care about</p>
            </div>
            <button
              onClick={() => this.setState((s) => ({ addOpen: !s.addOpen }))}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary/[0.12] border border-primary/[0.20] text-primary text-sm font-medium hover:bg-primary/[0.18] transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Market
            </button>
          </div>

          {/* Add market panel */}
          {addOpen && (
            <div className="glass-card rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-gray-300">Add to Watchlist</p>
              <input
                value={addSearch}
                onChange={(e) => this.setState({ addSearch: e.target.value })}
                placeholder="Search markets…"
                className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/[0.25] transition-colors"
              />
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto scrollbar-hide">
                {this.filteredMarkets().map((m) => (
                  <button
                    key={m.symbol}
                    onClick={() => { onAdd(m.symbol); this.setState({ addSearch: '' }); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.06] hover:border-primary/[0.20] hover:bg-primary/[0.05] text-left transition-all"
                  >
                    <Star className="w-3 h-3 text-gray-600" />
                    <div>
                      <p className="text-xs font-semibold text-white">{m.symbol}</p>
                      <p className="text-[10px] text-gray-600">{m.type}</p>
                    </div>
                  </button>
                ))}
                {this.filteredMarkets().length === 0 && (
                  <p className="col-span-2 text-xs text-gray-600 text-center py-4">No markets found</p>
                )}
              </div>
            </div>
          )}

          {/* Watchlist */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          ) : watchlist.length === 0 ? (
            <div className="glass-card rounded-xl flex flex-col items-center justify-center py-16 gap-3">
              <Star className="w-10 h-10 text-gray-700" />
              <p className="text-gray-500 text-sm">Your watchlist is empty</p>
              <p className="text-gray-700 text-xs">Click &quot;Add Market&quot; to start tracking</p>
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-gray-600 uppercase border-b border-white/[0.06]">
                    <th className="text-left py-2 px-4 font-mono">Market</th>
                    <th className="text-right py-2 px-4 font-mono">Price</th>
                    <th className="text-right py-2 px-4 font-mono">24h Change</th>
                    <th className="text-right py-2 px-4 font-mono">Volume</th>
                    <th className="py-2 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {watchedMarkets.map((m) => {
                    const t = tickers[m.symbol];
                    const change = t?.change24h ?? 0;
                    const positive = change >= 0;
                    return (
                      <tr key={m.symbol} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <CoinIcon symbol={m.symbol} size={24} />
                            <div>
                              <p className="font-semibold text-white">{m.symbol}</p>
                              <p className="text-[10px] text-gray-600">{m.type}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-white">
                          {t ? `$${t.price.toFixed(2)}` : '—'}
                        </td>
                        <td className={cn('py-3 px-4 text-right font-mono flex items-center justify-end gap-1', positive ? 'text-success' : 'text-error')}>
                          {t ? (
                            <>
                              {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {positive ? '+' : ''}{change.toFixed(2)}%
                            </>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-gray-500">
                          {t ? `$${(t.volume24h / 1e6).toFixed(1)}M` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onRemove(m.symbol)}
                            className="p-1.5 text-gray-600 hover:text-error transition-colors rounded-lg hover:bg-error/10"
                          >
                            <StarOff className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default function WatchlistPageWrapper() {
  const watchlist = useKaidoStore((s) => s.watchlist);
  const addToWatchlist = useKaidoStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useKaidoStore((s) => s.removeFromWatchlist);
  return (
    <WatchlistView
      watchlist={watchlist}
      onAdd={addToWatchlist}
      onRemove={removeFromWatchlist}
    />
  );
}
