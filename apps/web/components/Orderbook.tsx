'use client';

import { Component } from 'react';
import type { OrderbookLevel } from '@repo/types';
import { cn } from '../lib/utils';
import { useKaidoStore } from '../store';
import { CoinIcon } from './CoinIcon';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface InnerProps { symbol: string; midPrice: number }
interface InnerState { asks: OrderbookLevel[]; bids: OrderbookLevel[]; loading: boolean }

class OrderbookInner extends Component<InnerProps, InnerState> {
  override state: InnerState = { asks: [], bids: [], loading: true };
  private interval: ReturnType<typeof setInterval> | null = null;

  override componentDidMount() {
    void this.refresh();
    this.interval = setInterval(() => void this.refresh(), 1500);
  }

  override componentWillUnmount() {
    if (this.interval) clearInterval(this.interval);
  }

  override componentDidUpdate(prev: InnerProps) {
    if (prev.symbol !== this.props.symbol) {
      this.setState({ loading: true, asks: [], bids: [] });
      void this.refresh();
    }
  }

  private async refresh() {
    try {
      const res  = await fetch(`${API_URL}/markets/${this.props.symbol}/orderbook`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { asks: OrderbookLevel[]; bids: OrderbookLevel[] };
      this.setState({ asks: data.asks.slice(0, 14), bids: data.bids.slice(0, 14), loading: false });
    } catch {
      this.setState({ loading: false });
    }
  }

  override render() {
    const { asks, bids, loading } = this.state;
    const { midPrice } = this.props;

    const maxAsk  = asks.at(-1)?.total ?? 1;
    const maxBid  = bids.at(-1)?.total ?? 1;
    // Derive mid from actual orderbook data, not the Pyth ticker (they can differ)
    const bookMid = asks[0] && bids[0] ? (asks[0].price + bids[0].price) / 2 : midPrice;
    const spread  = asks[0] && bids[0] ? Math.abs(asks[0].price - bids[0].price).toFixed(2) : '—';
    const spreadPct = asks[0] && bids[0] && bookMid > 0
      ? ((Math.abs(asks[0].price - bids[0].price) / bookMid) * 100).toFixed(3)
      : null;

    const SkeletonRow = ({ side }: { side: 'ask' | 'bid' }) => (
      <div className="grid grid-cols-3 px-6 py-[3px] animate-pulse">
        <div className={cn('h-2 rounded w-12', side === 'ask' ? 'bg-error/10' : 'bg-success/10')} />
        <div className="h-2 bg-white/[0.04] rounded w-10 ml-auto" />
        <div className="h-2 bg-white/[0.03] rounded w-8 ml-auto" />
      </div>
    );

    return (
      <div className="flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 h-9 border-b border-white/[0.04] shrink-0">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.12em]">Order Book</span>
          <div className="flex items-center gap-1.5">
            <CoinIcon symbol={this.props.symbol} size={16} />
            <span className="text-[9px] font-mono text-gray-700">{this.props.symbol}</span>
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden font-mono text-[11px]">

          {/* Column headers */}
          <div className="grid grid-cols-3 px-6 py-1.5 text-[9px] font-bold text-gray-700 uppercase tracking-[0.08em] shrink-0">
            <span>Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Total</span>
          </div>

          {/* Asks — reversed so lowest ask is at bottom (nearest mid price) */}
          <div className="flex-1 flex flex-col justify-end overflow-hidden">
            {loading
              ? Array.from({ length: 14 }).map((_, i) => <SkeletonRow key={i} side="ask" />)
              : [...asks].reverse().map((ask, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-3 px-6 py-[3px] relative cursor-pointer hover:bg-white/[0.025] transition-colors"
                  >
                    <div
                      className="absolute inset-y-0 right-0 bg-error/[0.08] pointer-events-none"
                      style={{ width: `${(ask.total / maxAsk) * 100}%` }}
                    />
                    <span className="text-error z-10 relative font-semibold tracking-tight">{ask.price.toFixed(2)}</span>
                    <span className="text-right z-10 relative text-white/50">{ask.size.toFixed(2)}</span>
                    <span className="text-right z-10 relative text-white/25">{ask.total.toFixed(1)}</span>
                  </div>
                ))}
          </div>

          {/* Mid price / spread */}
          <div className="px-6 py-2 flex items-center justify-between border-y border-white/[0.05] bg-white/[0.015] shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-black text-white tracking-tighter">
                ${bookMid > 0 ? bookMid.toFixed(2) : '—'}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
            </div>
            <div className="text-right">
              <div className="text-[9px] text-gray-600 font-bold tracking-wide">
                SPREAD <span className="text-gray-500">{spread}</span>
                {spreadPct && <span className="text-gray-700 ml-1">({spreadPct}%)</span>}
              </div>
            </div>
          </div>

          {/* Bids */}
          <div className="flex-1 overflow-hidden">
            {loading
              ? Array.from({ length: 14 }).map((_, i) => <SkeletonRow key={i} side="bid" />)
              : bids.map((bid, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-3 px-6 py-[3px] relative cursor-pointer hover:bg-white/[0.025] transition-colors"
                  >
                    <div
                      className="absolute inset-y-0 right-0 bg-success/[0.08] pointer-events-none"
                      style={{ width: `${(bid.total / maxBid) * 100}%` }}
                    />
                    <span className="text-success z-10 relative font-semibold tracking-tight">{bid.price.toFixed(2)}</span>
                    <span className="text-right z-10 relative text-white/50">{bid.size.toFixed(2)}</span>
                    <span className="text-right z-10 relative text-white/25">{bid.total.toFixed(1)}</span>
                  </div>
                ))}
          </div>
        </div>
      </div>
    );
  }
}

export function Orderbook() {
  const tickers      = useKaidoStore((s) => s.tickers);
  const activeMarket = useKaidoStore((s) => s.activeMarket);
  const midPrice     = tickers[activeMarket]?.price ?? 0;
  return <OrderbookInner symbol={activeMarket} midPrice={midPrice} />;
}
