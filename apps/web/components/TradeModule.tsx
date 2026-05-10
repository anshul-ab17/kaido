'use client';

import { Component, type ChangeEvent } from 'react';
import { BrainCircuit, ChevronDown, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { useKaidoStore } from '../store';

type Side = 'long' | 'short';
type OrderType = 'market' | 'limit' | 'tp-sl';

interface InnerProps {
  currentPrice: number;
  activeMarket: string;
  walletConnected: boolean;
  walletKey: string | null;
  onOpenWallet: () => void;
  addToast: (t: { type: 'success' | 'error' | 'pending'; title: string; message?: string }) => void;
  defaultSide?: Side | undefined;
}

interface InnerState {
  side: Side;
  orderType: OrderType;
  size: string;
  limitPrice: string;
  leverage: number;
  tpEnabled: boolean;
  tpPrice: string;
  slPrice: string;
  submitting: boolean;
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const AVAILABLE_USDC = 1450.0;

class TradeModuleInner extends Component<InnerProps, InnerState> {
  override state: InnerState = {
    side: this.props.defaultSide ?? 'long',
    orderType: 'market',
    size: '',
    limitPrice: '',
    leverage: 1,
    tpEnabled: false,
    tpPrice: '',
    slPrice: '',
    submitting: false,
  };

  override componentDidUpdate(prev: InnerProps) {
    if (prev.currentPrice !== this.props.currentPrice && this.state.orderType === 'market') {
      // keep limit price in sync when switching to limit
    }
  }

  private setSide = (side: Side) => this.setState({ side });
  private setOrderType = (orderType: OrderType) => {
    const { currentPrice } = this.props;
    this.setState({
      orderType,
      limitPrice: orderType === 'limit' ? currentPrice.toFixed(2) : '',
    });
  };

  private handleSizeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) this.setState({ size: val });
  };

  private handleLimitPriceChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) this.setState({ limitPrice: val });
  };

  private setPercent = (pct: number) => {
    const amount = (AVAILABLE_USDC * pct).toFixed(2);
    this.setState({ size: amount });
  };

  private adjustLeverage = (delta: number) => {
    this.setState((s) => ({ leverage: Math.min(20, Math.max(1, s.leverage + delta)) }));
  };

  private handleExecute = async () => {
    const { walletConnected, onOpenWallet, currentPrice, activeMarket, walletKey, addToast } = this.props;
    if (!walletConnected) { onOpenWallet(); return; }
    const { side, orderType, size, limitPrice, leverage, tpPrice, slPrice } = this.state;
    if (!size || parseFloat(size) <= 0) return;

    this.setState({ submitting: true });
    addToast({ type: 'pending', title: 'Opening position…', message: `${side.toUpperCase()} ${activeMarket} $${size}` });

    try {
      // If TP/SL set, submit TP/SL order
      if ((tpPrice || slPrice) && (orderType === 'tp-sl' || orderType === 'limit')) {
        await fetch(`${API_URL}/trade/orders/tpsl`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            market: activeMarket, side, size: parseFloat(size),
            entryPrice: orderType === 'limit' ? parseFloat(limitPrice) : currentPrice,
            tpPrice: tpPrice ? parseFloat(tpPrice) : undefined,
            slPrice: slPrice ? parseFloat(slPrice) : undefined,
            leverage,
            walletAddress: walletKey ?? 'anon',
          }),
        });
      }
      // Get quote
      const quoteRes = await fetch(`${API_URL}/trade/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputToken: 'USDC', outputToken: activeMarket.split('-')[0], inputAmount: parseFloat(size), slippageBps: 50 }),
      });
      const quote = await quoteRes.json();
      // Build tx
      await fetch(`${API_URL}/trade/build-tx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeResult: quote, walletAddress: walletKey ?? 'anon' }),
      });

      addToast({
        type: 'success',
        title: 'Position opened',
        message: `${side.toUpperCase()} ${parseFloat(size) * leverage}x ${activeMarket} @ $${currentPrice.toFixed(2)}`,
      });
      this.setState({ size: '', tpPrice: '', slPrice: '', submitting: false });
    } catch {
      addToast({ type: 'error', title: 'Order failed', message: 'Could not reach API' });
      this.setState({ submitting: false });
    }
  };

  private handleLeverageInput = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) this.setState({ leverage: Math.min(20, Math.max(1, val)) });
  };

  private getTokenAmount(): string {
    const { currentPrice } = this.props;
    const { size } = this.state;
    if (!size || !currentPrice) return '0.000';
    return (parseFloat(size) / currentPrice).toFixed(3);
  }

  private getLiqPrice(): string {
    const { currentPrice } = this.props;
    const { side, leverage } = this.state;
    if (leverage <= 1) return '—';
    const liqOffset = currentPrice * (1 / leverage) * 0.9;
    return `$${(side === 'long' ? currentPrice - liqOffset : currentPrice + liqOffset).toFixed(2)}`;
  }

  override render() {
    const { side, orderType, size, limitPrice, leverage, tpEnabled, tpPrice, slPrice, submitting } = this.state;
    const { currentPrice, activeMarket, walletConnected } = this.props;
    const baseToken = activeMarket.split('-')[0] ?? 'SOL';
    const isLong = side === 'long';
    const fee = size ? (parseFloat(size) * 0.0005).toFixed(4) : '0.0000';

    return (
      <div className="flex flex-col p-4 gap-4">
        {/* Long / Short toggle */}
        <div className="grid grid-cols-2 gap-1.5 bg-white/[0.03] rounded-full p-1 border border-white/[0.05]">
          <button
            onClick={() => this.setSide('long')}
            className={cn(
              'py-2.5 rounded-full text-xs font-bold transition-all duration-300',
              isLong
                ? 'bg-success text-white shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            )}
          >
            Long
          </button>
          <button
            onClick={() => this.setSide('short')}
            className={cn(
              'py-2.5 rounded-full text-xs font-bold transition-all duration-300',
              !isLong
                ? 'bg-error text-white shadow-[0_0_20px_rgba(239,68,68,0.25)]'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            )}
          >
            Short
          </button>
        </div>

        {/* Order type tabs */}
        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.05] relative">
          {(['market', 'limit', 'tp-sl'] as OrderType[]).map((t) => (
            <button
              key={t}
              onClick={() => this.setOrderType(t)}
              className={cn(
                'flex-1 py-2 text-[11px] font-bold rounded-lg transition-all duration-200 capitalize relative z-10',
                orderType === t ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              )}
            >
              {t === 'tp-sl' ? 'TP/SL' : t}
              {orderType === t && (
                <span className="absolute inset-0 bg-white/10 rounded-lg -z-10 shadow-sm" />
              )}
            </button>
          ))}
        </div>

        {/* Limit price (shown only for limit / tp-sl) */}
        {orderType !== 'market' && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-medium text-gray-500 px-1">
              <span>Limit Price</span>
              <span className="font-mono text-white/50">${currentPrice.toFixed(2)}</span>
            </div>
            <div className="input-premium flex items-center px-4 h-12">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={limitPrice}
                onChange={this.handleLimitPriceChange}
                className="bg-transparent flex-1 text-sm font-mono font-bold outline-none placeholder-white/10"
              />
              <span className="text-[11px] font-bold text-gray-500 tracking-wider">USDC</span>
            </div>
          </div>
        )}

        {/* Size input */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-medium text-gray-500 px-1">
            <span>Size</span>
            <span className="font-mono text-white/50">Avail: {AVAILABLE_USDC.toLocaleString()}</span>
          </div>
          <div className="input-premium flex items-center px-4 h-12">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={size}
              onChange={this.handleSizeChange}
              className="bg-transparent flex-1 text-sm font-mono font-bold outline-none placeholder-white/10"
            />
            <button className="flex items-center gap-2 text-[11px] font-bold text-gray-400 hover:text-white transition-colors shrink-0 group">
              <span>USDC</span>
              <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
          {/* Percent shortcuts */}
          <div className="grid grid-cols-4 gap-1.5 mt-2.5">
            {([0.25, 0.5, 0.75, 1] as const).map((pct) => (
              <button
                key={pct}
                onClick={() => this.setPercent(pct)}
                className="py-1.5 text-[10px] font-bold text-gray-500 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] rounded-lg transition-all border border-white/[0.05] active:scale-95"
              >
                {pct === 1 ? 'MAX' : `${pct * 100}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Leverage */}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between items-center px-1">
            <span className="text-[11px] font-medium text-gray-500">Leverage</span>
            <span className="font-mono text-primary font-bold bg-primary/15 border border-primary/25 px-2 py-0.5 rounded text-[11px] min-w-[36px] text-center">{leverage}×</span>
          </div>

          {/* Range slider — track rendered via inline background gradient on the input */}
          <div className="relative px-1">
            <style>{`
              .lev-slider{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:9999px;outline:none;cursor:pointer;}
              .lev-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;border-radius:50%;background:#BCEB02;border:2.5px solid #0B0C00;box-shadow:0 0 10px rgba(188,235,2,0.55),0 0 0 3px rgba(188,235,2,0.18);cursor:grab;margin-top:-6px;transition:box-shadow .15s,transform .15s;}
              .lev-slider::-webkit-slider-thumb:hover{box-shadow:0 0 14px rgba(188,235,2,0.75),0 0 0 5px rgba(188,235,2,0.22);transform:scale(1.1);}
              .lev-slider::-webkit-slider-thumb:active{cursor:grabbing;transform:scale(1.18);}
              .lev-slider::-webkit-slider-runnable-track{height:4px;border-radius:9999px;}
              .lev-slider::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#BCEB02;border:2.5px solid #0B0C00;box-shadow:0 0 10px rgba(188,235,2,0.55);cursor:grab;}
              .lev-slider::-moz-range-track{height:4px;border-radius:9999px;background:rgba(255,255,255,0.07);}
              .lev-slider::-moz-range-progress{height:4px;border-radius:9999px;background:rgba(188,235,2,0.80);}
            `}</style>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={leverage}
              onChange={(e) => this.setState({ leverage: parseInt(e.target.value, 10) })}
              className="lev-slider w-full"
              style={{
                background: `linear-gradient(to right,rgba(188,235,2,0.80) ${((leverage-1)/19)*100}%,rgba(255,255,255,0.07) ${((leverage-1)/19)*100}%)`,
              }}
            />
            {/* Preset pills */}
            <div className="flex justify-between mt-2.5">
              {[1, 2, 5, 10, 20].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => this.setState({ leverage: v })}
                  className={cn(
                    'px-2 py-0.5 text-[9px] font-bold rounded-full border transition-all',
                    leverage === v
                      ? 'bg-primary/20 border-primary/40 text-primary'
                      : 'border-white/[0.08] text-gray-600 hover:text-gray-300 hover:border-white/[0.15]',
                  )}
                >
                  {v}×
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TP/SL inputs — shown for tp-sl tab */}
        {orderType === 'tp-sl' && (
          <div className="space-y-2">
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-medium text-gray-500 px-1">
                <span>Take Profit</span>
                <span className="text-success font-mono text-[10px]">
                  {tpPrice && currentPrice ? `+${(((parseFloat(tpPrice) - currentPrice) / currentPrice) * 100).toFixed(1)}%` : ''}
                </span>
              </div>
              <div className="input-premium flex items-center px-4 h-10">
                <input
                  type="text" inputMode="decimal" placeholder="0.00"
                  value={tpPrice}
                  onChange={(e) => this.setState({ tpPrice: e.target.value })}
                  className="bg-transparent flex-1 text-sm font-mono font-bold outline-none placeholder-white/10"
                />
                <span className="text-[11px] font-bold text-success">TP</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-medium text-gray-500 px-1">
                <span>Stop Loss</span>
                <span className="text-error font-mono text-[10px]">
                  {slPrice && currentPrice ? `${(((parseFloat(slPrice) - currentPrice) / currentPrice) * 100).toFixed(1)}%` : ''}
                </span>
              </div>
              <div className="input-premium flex items-center px-4 h-10">
                <input
                  type="text" inputMode="decimal" placeholder="0.00"
                  value={slPrice}
                  onChange={(e) => this.setState({ slPrice: e.target.value })}
                  className="bg-transparent flex-1 text-sm font-mono font-bold outline-none placeholder-white/10"
                />
                <span className="text-[11px] font-bold text-error">SL</span>
              </div>
            </div>
          </div>
        )}

        {/* AI Route insight */}
        <div className="glass border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden group hover:border-accent/30 transition-colors">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <BrainCircuit className="w-12 h-12 text-accent" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Execution Engine</span>
          </div>
          <p className="text-[12px] text-gray-400 leading-relaxed relative z-10">
            Routing via <span className="text-white font-bold">Orca + OpenBook</span>. 
            Price impact <span className="text-success font-bold">&lt;0.01%</span>.
          </p>
        </div>

        {/* Order details */}
        <div className="space-y-2 text-[12px] px-1 py-1">
          <div className="flex justify-between">
            <span className="text-gray-500 flex items-center gap-1.5 cursor-help">Liquidation <Info className="w-3 h-3" /></span>
            <span className="font-mono text-white/70">{this.getLiqPrice()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Trading Fee</span>
            <span className="font-mono text-white/70">${fee}</span>
          </div>
        </div>

        {/* Execute button */}
        <button
          onClick={() => void this.handleExecute()}
          disabled={submitting}
          className={cn(
            'w-full py-4 rounded-2xl text-[13px] font-black transition-all active:scale-[0.97] uppercase tracking-wider disabled:opacity-60',
            isLong
              ? 'bg-success text-white shadow-[0_10px_25px_-5px_rgba(16,185,129,0.3)] hover:shadow-[0_15px_30px_-5px_rgba(16,185,129,0.4)] hover:brightness-110'
              : 'bg-error text-white shadow-[0_10px_25px_-5px_rgba(239,68,68,0.3)] hover:shadow-[0_15px_30px_-5px_rgba(239,68,68,0.4)] hover:brightness-110'
          )}
        >
          {submitting ? 'Submitting…' : !walletConnected ? 'Connect Wallet' : isLong ? `Open Long ${baseToken}` : `Open Short ${baseToken}`}
        </button>

        <p className="text-[10px] text-gray-600 text-center font-medium tracking-tight">
          By trading, you agree to the <span className="text-white/40 hover:text-white/60 cursor-pointer underline underline-offset-2">Terms of Service</span>
        </p>
      </div>
    );
  }
}

export function TradeModule({ defaultSide }: { defaultSide?: Side }) {
  const tickers = useKaidoStore((s) => s.tickers);
  const activeMarket = useKaidoStore((s) => s.activeMarket);
  const wallet = useKaidoStore((s) => s.wallet);
  const setWalletModalOpen = useKaidoStore((s) => s.setWalletModalOpen);
  const addToast = useKaidoStore((s) => s.addToast);
  const price = tickers[activeMarket]?.price ?? 145.20;
  return (
    <TradeModuleInner
      currentPrice={price}
      activeMarket={activeMarket}
      walletConnected={wallet.connected}
      walletKey={wallet.publicKey}
      onOpenWallet={() => setWalletModalOpen(true)}
      addToast={addToast}
      defaultSide={defaultSide}
    />
  );
}
