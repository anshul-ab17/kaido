'use client';

import { Component } from 'react';
import { cn } from '../lib/utils';

type Tab = 'positions' | 'orders' | 'history' | 'fills';

const TABS: { key: Tab; label: string }[] = [
  { key: 'positions', label: 'Positions (0)' },
  { key: 'orders', label: 'Open Orders' },
  { key: 'history', label: 'Trade History' },
  { key: 'fills', label: 'Fills' },
];

interface PositionsPanelState {
  tab: Tab;
}

export class PositionsPanel extends Component<Record<string, never>, PositionsPanelState> {
  override state: PositionsPanelState = { tab: 'positions' };

  override render() {
    const { tab } = this.state;
    return (
      <div className="h-[200px] border-t border-white/[0.04] flex flex-col shrink-0 bg-[#141500]/40 backdrop-blur-sm">
        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-white/[0.04] h-10 px-4 shrink-0 overflow-x-auto scrollbar-hide">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => this.setState({ tab: key })}
              className={cn(
                'px-4 py-1.5 text-[11px] font-bold transition-all whitespace-nowrap shrink-0 rounded-full',
                tab === key
                  ? 'text-white bg-white/5 shadow-sm shadow-black/20'
                  : 'text-gray-600 hover:text-gray-400'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-10 h-10 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-800" />
          </div>
          <div className="text-center">
            <p className="text-[12px] font-black uppercase tracking-[0.15em] text-gray-700">
              No {tab} found
            </p>
            <p className="text-[10px] text-gray-800 mt-1 font-medium">Connect your wallet to synchronize your trade data</p>
          </div>
        </div>
      </div>
    );
  }
}
