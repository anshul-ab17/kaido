'use client';

import { Component } from 'react';
import type { PredictionEvent } from '@repo/types';
import { Navbar } from '../../components/Navbar';
import { StatusBar } from '../../components/StatusBar';
import { Clock, TrendingUp, Layers } from 'lucide-react';
import { cn } from '../../lib/utils';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function daysUntil(ts: number): number {
  return Math.max(0, Math.ceil((ts - Date.now()) / 86_400_000));
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

interface EventsState {
  events: PredictionEvent[];
  loading: boolean;
  category: string;
}

class EventsView extends Component<Record<string, never>, EventsState> {
  override state: EventsState = { events: [], loading: true, category: 'All' };

  override componentDidMount() {
    void fetch(`${API_URL}/events`)
      .then((r) => r.json() as Promise<{ events: PredictionEvent[] }>)
      .then((data) => this.setState({ events: data.events, loading: false }))
      .catch(() => this.setState({ loading: false }));
  }

  override render() {
    const { events, loading, category } = this.state;
    const categories = ['All', ...new Set(events.map((e) => e.category))];
    const filtered = category === 'All' ? events : events.filter((e) => e.category === category);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading">Prediction Markets</h1>
            <p className="text-sm text-gray-500 mt-0.5">Trade on real-world outcomes</p>
          </div>
          <div className="glass px-3 py-1.5 rounded-full text-[10px] font-mono text-gray-400">
            {filtered.length} markets open
          </div>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => this.setState({ category: cat })}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                category === cat ? 'bg-primary text-white glow-crimson' : 'glass text-gray-400 hover:text-white'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Events grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card p-5 animate-pulse space-y-3">
                  <div className="h-4 bg-white/5 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-full" />
                  <div className="h-3 bg-white/5 rounded w-5/6" />
                  <div className="flex gap-3 mt-4">
                    <div className="h-16 bg-white/5 rounded flex-1" />
                    <div className="h-16 bg-white/5 rounded flex-1" />
                  </div>
                </div>
              ))
            : filtered.map((event) => (
                <div
                  key={event.id}
                  className="glass-card p-5 flex flex-col gap-4 hover:border-white/15 transition-all cursor-pointer"
                >
                  {/* Category + time */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-accent/10 text-accent rounded-full">
                      {event.category}
                    </span>
                    <div className="flex items-center gap-1 text-gray-500 text-[10px]">
                      <Clock className="w-3 h-3" />
                      <span>{daysUntil(event.resolutionDate)}d left</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-bold leading-snug">{event.title}</h3>

                  {/* YES/NO prices */}
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-lg bg-success/10 border border-success/20 p-3 text-center">
                      <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">YES</div>
                      <div className="text-lg font-bold text-success font-mono">
                        {(event.yesPrice * 100).toFixed(0)}¢
                      </div>
                    </div>
                    <div className="flex-1 rounded-lg bg-error/10 border border-error/20 p-3 text-center">
                      <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">NO</div>
                      <div className="text-lg font-bold text-error font-mono">
                        {(event.noPrice * 100).toFixed(0)}¢
                      </div>
                    </div>
                  </div>

                  {/* Probability bar */}
                  <div>
                    <div className="h-1.5 rounded-full bg-error/30 overflow-hidden">
                      <div
                        className="h-full bg-success rounded-full transition-all"
                        style={{ width: `${event.yesPrice * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-gray-500">
                      <span>{(event.yesPrice * 100).toFixed(0)}% YES</span>
                      <span>{(event.noPrice * 100).toFixed(0)}% NO</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-3">
                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                      <TrendingUp className="w-3 h-3" />
                      <span>Vol: {formatVolume(event.volume)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                      <Layers className="w-3 h-3" />
                      <span>Liq: {formatVolume(event.liquidity)}</span>
                    </div>
                  </div>

                  {/* Trade buttons */}
                  <div className="flex gap-2">
                    <button className="flex-1 py-2 rounded-lg bg-success/15 border border-success/30 text-success text-xs font-bold hover:bg-success/25 transition-all">
                      Buy YES
                    </button>
                    <button className="flex-1 py-2 rounded-lg bg-error/15 border border-error/30 text-error text-xs font-bold hover:bg-error/25 transition-all">
                      Buy NO
                    </button>
                  </div>
                </div>
              ))}
        </div>
      </div>
    );
  }
}

export default function EventsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-hide">
        <div className="max-w-7xl mx-auto">
          <EventsView />
        </div>
      </main>
      <StatusBar />
    </div>
  );
}
