'use client';

import { Component } from 'react';
import type { OrderbookLevel } from '@repo/types';

const MOCK_ASKS: OrderbookLevel[] = [
  { price: 151.25, size: 45.2, total: 45.2 },
  { price: 151.10, size: 12.8, total: 58.0 },
  { price: 151.05, size: 8.5,  total: 66.5 },
  { price: 150.95, size: 150.0, total: 216.5 },
  { price: 150.90, size: 42.1, total: 258.6 },
];

const MOCK_BIDS: OrderbookLevel[] = [
  { price: 150.75, size: 35.5, total: 35.5 },
  { price: 150.70, size: 12.0, total: 47.5 },
  { price: 150.65, size: 95.2, total: 142.7 },
  { price: 150.55, size: 8.4,  total: 151.1 },
  { price: 150.50, size: 42.0, total: 193.1 },
];

const MAX_TOTAL = 300;

export class Orderbook extends Component {
  override render() {
    return (
      <div className="glass-card flex flex-col h-full">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400 font-heading">Orderbook</h3>
          <div className="flex gap-1">
            <div className="w-4 h-4 bg-error/30 rounded-sm" />
            <div className="w-4 h-4 bg-success/30 rounded-sm" />
          </div>
        </div>
        <div className="flex-1 overflow-hidden font-mono text-[11px]">
          <div className="grid grid-cols-3 px-4 py-2 text-gray-600 text-[10px] uppercase tracking-wider">
            <span>Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Total</span>
          </div>
          <div className="space-y-px">
            {[...MOCK_ASKS].reverse().map((ask, i) => (
              <div key={i} className="grid grid-cols-3 px-4 py-1 relative cursor-pointer hover:bg-white/[0.03]">
                <div className="absolute inset-0 bg-error/[0.06]" style={{ width: `${(ask.total / MAX_TOTAL) * 100}%` }} />
                <span className="text-error z-10">{ask.price.toFixed(2)}</span>
                <span className="text-right z-10 text-gray-300">{ask.size.toFixed(1)}</span>
                <span className="text-right z-10 text-gray-500">{ask.total.toFixed(1)}</span>
              </div>
            ))}
          </div>
          <div className="py-3 text-center border-y border-white/5 my-1">
            <span className="text-base font-bold text-white">$150.80</span>
            <span className="text-[10px] text-gray-500 ml-2 font-sans">Market</span>
          </div>
          <div className="space-y-px">
            {MOCK_BIDS.map((bid, i) => (
              <div key={i} className="grid grid-cols-3 px-4 py-1 relative cursor-pointer hover:bg-white/[0.03]">
                <div className="absolute inset-0 bg-success/[0.06]" style={{ width: `${(bid.total / MAX_TOTAL) * 100}%` }} />
                <span className="text-success z-10">{bid.price.toFixed(2)}</span>
                <span className="text-right z-10 text-gray-300">{bid.size.toFixed(1)}</span>
                <span className="text-right z-10 text-gray-500">{bid.total.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
}
