'use client';

import { Component, type ChangeEvent } from 'react';
import { ArrowDownUp, BrainCircuit, Info, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { Badge } from '@repo/ui/badge';

type TradeMode = 'swap' | 'limit';

interface TradeModuleState {
  mode: TradeMode;
  payAmount: string;
  receiveAmount: string;
}

export class TradeModule extends Component<Record<string, never>, TradeModuleState> {
  override state: TradeModuleState = { mode: 'swap', payAmount: '', receiveAmount: '' };

  private setMode = (mode: TradeMode) => this.setState({ mode });

  private handlePayChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    this.setState({
      payAmount: val,
      receiveAmount: val ? (parseFloat(val) * 150.8).toFixed(2) : '',
    });
  };

  private flipTokens = () =>
    this.setState((s) => ({ payAmount: s.receiveAmount, receiveAmount: s.payAmount }));

  override render() {
    const { mode, payAmount, receiveAmount } = this.state;
    return (
      <div className="glass-card p-5 flex flex-col gap-5">
        {/* Mode tabs */}
        <div className="flex bg-black/50 rounded-lg p-1">
          {(['swap', 'limit'] as TradeMode[]).map((m) => (
            <button
              key={m}
              onClick={() => this.setMode(m)}
              className={cn(
                'flex-1 py-2 text-sm font-semibold rounded-md capitalize transition-all',
                mode === m ? 'bg-primary text-white glow-crimson' : 'text-gray-400 hover:text-white'
              )}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Pay */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-gray-500 px-1">
            <span>You Pay</span><span>Balance: 12.5 SOL</span>
          </div>
          <div className="bg-black/60 border border-white/5 p-4 rounded-xl flex items-center justify-between hover:border-white/15 transition-all">
            <input
              type="number"
              placeholder="0.00"
              value={payAmount}
              onChange={this.handlePayChange}
              className="bg-transparent border-none outline-none text-2xl font-bold w-1/2 [appearance:textfield]"
            />
            <button className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 transition-all">
              <div className="w-4 h-4 rounded-full bg-purple-500" />
              <span className="font-bold text-sm">SOL</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Flip */}
        <div className="flex justify-center -my-2 relative z-10">
          <button onClick={this.flipTokens} className="bg-surface border border-white/10 p-2 rounded-lg hover:scale-110 transition-all text-primary">
            <ArrowDownUp className="w-4 h-4" />
          </button>
        </div>

        {/* Receive */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-gray-500 px-1">
            <span>You Receive</span><span>Balance: 1,450 USDC</span>
          </div>
          <div className="bg-black/60 border border-white/5 p-4 rounded-xl flex items-center justify-between">
            <input
              type="number"
              placeholder="0.00"
              value={receiveAmount}
              readOnly
              className="bg-transparent border-none outline-none text-2xl font-bold w-1/2 text-gray-400"
            />
            <button className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 transition-all">
              <div className="w-4 h-4 rounded-full bg-blue-400" />
              <span className="font-bold text-sm">USDC</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
          </div>
        </div>

        {/* AI Route Insights */}
        <div className="bg-accent/5 border border-accent/20 p-4 rounded-xl relative overflow-hidden group">
          <div className="absolute top-2 right-2 opacity-20 group-hover:opacity-100 transition-opacity">
            <BrainCircuit className="text-accent w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="accent" pulse>AI Route</Badge>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Optimizing via <span className="text-white font-semibold">Orca CLMM + OpenBook</span>. Impact: <span className="text-success">&lt;0.01%</span>. Savings: <span className="text-success">$4.20</span> vs direct AMM.
          </p>
        </div>

        {/* Details */}
        <div className="space-y-2 text-[11px]">
          <div className="flex justify-between">
            <span className="text-gray-500 flex items-center gap-1">Slippage <Info className="w-3 h-3" /></span>
            <span className="font-mono text-white">0.1%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Confidence</span>
            <span className="text-success font-bold">98.5% High</span>
          </div>
        </div>

        <button className="w-full py-3.5 bg-primary text-white rounded-xl text-base font-bold hover:brightness-110 active:scale-[0.99] transition-all glow-crimson">
          Execute Trade
        </button>
      </div>
    );
  }
}
