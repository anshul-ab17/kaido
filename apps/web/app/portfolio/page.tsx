'use client';

import { Component, createRef, type ChangeEvent } from 'react';
import { createChart, ColorType, AreaSeries } from 'lightweight-charts';
import type { LucideIcon } from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { StatusBar } from '../../components/StatusBar';
import {
  Wallet, Activity, ArrowUpRight, ArrowDownRight,
  Download, Upload, X, Copy, ExternalLink,
  BrainCircuit, CreditCard, Link2, CheckCircle2, Layers,
} from 'lucide-react';
import { useKaidoStore, type EventPosition } from '../../store';
import { cn } from '../../lib/utils';
import { CoinIcon } from '../../components/CoinIcon';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

// ── Types ──────────────────────────────────────────────────────────────────

// Jupiter Prediction position (subset of API shape)
interface JupPosition {
  pubkey:         string;
  marketId:       string;
  isYes:          boolean;
  contracts:      string;
  avgPriceUsd:    string;   // micro USD
  totalCostUsd:   string;   // micro USD
  valueUsd:       string | null;
  pnlUsd:         string | null;
  pnlUsdPercent:  number | null;
  payoutUsd:      string;   // micro USD
  claimable:      boolean;
  claimed:        boolean;
  openedAt:       number;
  eventMetadata:  { title: string; slug: string; category: string };
  marketMetadata: { title: string };
}

interface Holding { symbol: string; amount: number; usdValue: number; change24h: number; avgPrice: number }

interface PortfolioData {
  holdings: Holding[];
  totalValue: number;
  pnl24h: number;
  pnl24hPct: number;
  realizedPnl: number;
  unrealizedPnl: number;
  marginUsed: number;
  availableMargin: number;
  accountHealth: number;
  avgLeverage: number;
}

interface Position {
  id: string; market: string; side: string; size: number; notional: number;
  entryPrice: number; markPrice: number; unrealizedPnl: number; unrealizedPnlPct: number;
  liquidationPrice: number; margin: number; leverage: number; openedAt: string;
}

interface Order {
  id: string; market: string; side: string; type: string; price: number;
  size: number; filled: number; status: string; createdAt: string;
}

interface Trade {
  id: string; market: string; side: string; size: number; price: number;
  notional: number; fee: number; realizedPnl: number | null; timestamp: string; signature: string;
}

interface FundingPayment {
  id: string; market: string; side: string; rate: number; payment: number; timestamp: string;
}

interface PerfPoint { time: number; value: number }

type PortfolioTab = 'holdings' | 'positions' | 'orders' | 'history' | 'funding' | 'predictions' | 'analytics';
type PerfRange    = '7d' | '30d' | 'all';
type DepositTab   = 'deposit' | 'withdraw';
type DepositMethod = 'crypto' | 'card';

// ── Helpers ────────────────────────────────────────────────────────────────

// CoinIcon imported from shared component above

function EmptyState({ icon: Icon, label, sub }: { icon: LucideIcon; label: string; sub: string }) {
  return (
    <div className="glass-card flex flex-col items-center justify-center py-16 gap-3">
      <Icon className="w-8 h-8 text-gray-700" />
      <p className="font-mono text-xs uppercase tracking-widest font-bold text-gray-600">{label}</p>
      <p className="text-[11px] text-gray-700">{sub}</p>
    </div>
  );
}

function SideBadge({ side }: { side: string }) {
  const long = side === 'long';
  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', long ? 'bg-success/10 text-success' : 'bg-error/10 text-error')}>
      {side.toUpperCase()}
    </span>
  );
}

// ── Performance Chart ──────────────────────────────────────────────────────

interface PerfChartProps { data: PerfPoint[]; loading: boolean; onRangeChange: (r: PerfRange) => void }

class PerformanceChart extends Component<PerfChartProps, { range: PerfRange }> {
  override state = { range: '30d' as PerfRange };
  private containerRef = createRef<HTMLDivElement>();
  private chart: ReturnType<typeof createChart> | null = null;
  private series: { setData: (d: PerfPoint[]) => void } | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;

  override componentDidMount() {
    this.rafId = requestAnimationFrame(() => this.initChart());
  }

  override componentDidUpdate(prev: PerfChartProps) {
    if (prev.data !== this.props.data && this.series && this.props.data.length > 0) {
      this.series.setData(this.props.data);
      this.chart?.timeScale().fitContent();
    }
  }

  override componentWillUnmount() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.chart?.remove();
  }

  private initChart() {
    const el = this.containerRef.current;
    if (!el) return;
    this.chart = createChart(el, {
      width: el.clientWidth || 800,
      height: el.clientHeight || 180,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#4B5563', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" },
      grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
      crosshair: {
        mode: 1,
        vertLine: { labelBackgroundColor: '#0B0C00', color: 'rgba(188,235,2,0.30)', width: 1, style: 3 },
        horzLine: { labelBackgroundColor: '#BCEB02', color: 'rgba(188,235,2,0.30)', width: 1, style: 3 },
      },
      timeScale: { borderColor: 'rgba(255,255,255,0.04)', timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.04)', textColor: '#4B5563' },
      handleScroll: true,
      handleScale: true,
    });

    this.series = this.chart.addSeries(AreaSeries, {
      lineColor: '#BCEB02',
      topColor: 'rgba(188,235,2,0.22)',
      bottomColor: 'rgba(188,235,2,0.00)',
      lineWidth: 2,
    }) as unknown as { setData: (d: PerfPoint[]) => void };

    if (this.props.data.length > 0) {
      this.series.setData(this.props.data);
      this.chart.timeScale().fitContent();
    }

    this.resizeObserver = new ResizeObserver(() => {
      if (el && this.chart) this.chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    this.resizeObserver.observe(el);
  }

  override render() {
    const { range } = this.state;
    const { loading, onRangeChange } = this.props;
    return (
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-4 h-9 border-b border-primary/[0.08] shrink-0">
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Portfolio Value</span>
          <div className="flex gap-px">
            {(['7d', '30d', 'all'] as PerfRange[]).map((r) => (
              <button
                key={r}
                onClick={() => { this.setState({ range: r }); onRangeChange(r); }}
                className={cn('px-2.5 py-0.5 text-[10px] font-bold rounded transition-colors uppercase', range === r ? 'bg-primary/20 text-primary' : 'text-gray-600 hover:text-gray-400')}
              >
                {r === 'all' ? 'ALL' : r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="relative h-[180px]">
          <div ref={this.containerRef} className="absolute inset-0" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0B0C00]/60 z-10">
              <div className="w-5 h-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    );
  }
}

// ── Deposit Modal ──────────────────────────────────────────────────────────

interface DepositModalProps { onClose: () => void; initialTab?: DepositTab }
interface DepositModalState {
  tab: DepositTab; method: DepositMethod; amount: string; currency: 'USDC' | 'SOL';
  loading: boolean; copied: boolean;
  result: { depositAddress?: string; checkoutUrl?: string; memo?: string } | null;
}

class DepositModal extends Component<DepositModalProps, DepositModalState> {
  override state: DepositModalState = {
    tab: this.props.initialTab ?? 'deposit',
    method: 'crypto', amount: '', currency: 'USDC',
    loading: false, copied: false, result: null,
  };

  private handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '' || /^\d*\.?\d*$/.test(v)) this.setState({ amount: v });
  };

  private handleSubmit = async () => {
    const { amount, currency, method } = this.state;
    if (!amount) return;
    this.setState({ loading: true });
    try {
      const res = await fetch(`${API_URL}/deposits/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(amount), currency, method }),
      });
      const data = (await res.json()) as { depositAddress?: string; checkoutUrl?: string; memo?: string };
      this.setState({ result: data });
    } catch { /* no-op */ }
    finally { this.setState({ loading: false }); }
  };

  private handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  override render() {
    const { onClose } = this.props;
    const { tab, method, amount, currency, loading, copied, result } = this.state;

    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="w-full max-w-md mx-4 bg-[#0E0F00] border border-primary/[0.15] rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.7)]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 h-14 border-b border-primary/[0.08]">
            <div className="flex gap-px bg-white/[0.04] rounded-lg p-0.5">
              {(['deposit', 'withdraw'] as DepositTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => this.setState({ tab: t, result: null, amount: '' })}
                  className={cn('px-4 py-1.5 text-xs font-bold rounded-md capitalize transition-all', tab === t ? 'bg-primary text-black' : 'text-gray-500 hover:text-gray-300')}
                >
                  {t}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/[0.05]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* ── Deposit form ── */}
            {tab === 'deposit' && !result && (
              <>
                <div className="grid grid-cols-2 gap-2">
                    {/* Crypto option */}
                  <button
                    onClick={() => this.setState({ method: 'crypto' })}
                    className={cn('py-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all', method === 'crypto' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/[0.06] text-gray-500 hover:border-white/[0.12] hover:text-gray-300')}
                  >
                    <Link2 className="w-3.5 h-3.5" /> Crypto Transfer
                  </button>
                  {/* Dodo Pay option */}
                  <button
                    onClick={() => this.setState({ method: 'card' })}
                    className={cn('py-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all', method === 'card' ? 'border-[#FF6B35]/40 bg-[#FF6B35]/10 text-[#FF6B35]' : 'border-white/[0.06] text-gray-500 hover:border-white/[0.12] hover:text-gray-300')}
                  >
                    {/* Dodo logo */}
                    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z"/>
                    </svg>
                    Dodo Pay
                  </button>
                </div>

                <div>
                  <label className="text-[10px] text-gray-600 uppercase font-bold tracking-wider block mb-1.5">Amount</label>
                  <div className="flex items-center bg-black/50 border border-white/[0.07] rounded-xl px-4 h-12 hover:border-primary/30 transition-colors gap-2">
                    <span className="text-gray-600 text-sm font-mono">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      onChange={this.handleAmountChange}
                      className="bg-transparent flex-1 text-lg font-mono font-bold outline-none placeholder-gray-700"
                    />
                    <select
                      value={currency}
                      onChange={(e) => this.setState({ currency: e.target.value as 'USDC' | 'SOL' })}
                      className="bg-transparent text-sm font-bold text-gray-300 outline-none cursor-pointer"
                    >
                      <option value="USDC">USDC</option>
                      <option value="SOL">SOL</option>
                    </select>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[100, 500, 1000, 5000].map((v) => (
                      <button key={v} onClick={() => this.setState({ amount: v.toString() })}
                        className="flex-1 py-1 text-[10px] font-semibold text-gray-600 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] rounded-lg border border-white/[0.05] transition-all">
                        ${v >= 1000 ? `${v / 1000}K` : v}
                      </button>
                    ))}
                  </div>
                </div>

                {method === 'card' && (
                  <p className="text-[10px] text-gray-600 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04]">
                    Powered by Dodo Payments — card, bank transfer, SEPA. Funds settle as USDC on Solana.
                  </p>
                )}

                <button
                  onClick={this.handleSubmit}
                  disabled={!amount || loading}
                  className="w-full py-3 bg-primary text-black rounded-xl text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <><Download className="w-4 h-4" />{method === 'card' ? 'Continue to Dodo Pay' : 'Generate Deposit Address'}</>}
                </button>
              </>
            )}

            {/* ── Crypto result ── */}
            {result?.depositAddress && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span className="text-sm font-semibold">Send {currency} on Solana to:</span>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-white/[0.06]">
                  <p className="font-mono text-[11px] text-white break-all leading-relaxed">{result.depositAddress}</p>
                  <button
                    onClick={() => this.handleCopy(result.depositAddress!)}
                    className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold transition-colors text-primary hover:text-primary/80"
                  >
                    <Copy className="w-3 h-3" />{copied ? 'Copied!' : 'Copy Address'}
                  </button>
                </div>
                {result.memo && <p className="text-[10px] text-gray-600 font-mono">Reference: <span className="text-gray-400">{result.memo}</span></p>}
                <p className="text-[10px] text-gray-700">Deposits confirm in 1–2 minutes on Solana.</p>
                <button onClick={() => this.setState({ result: null })} className="w-full py-2 text-xs text-gray-500 hover:text-white transition-colors font-semibold">
                  Make Another Deposit
                </button>
              </div>
            )}

            {/* ── Card checkout result ── */}
            {result?.checkoutUrl && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span className="text-sm font-semibold">Checkout session ready</span>
                </div>
                <p className="text-xs text-gray-500">Complete payment securely via Dodo Payments. Funds arrive as USDC after confirmation.</p>
                <a href={result.checkoutUrl} target="_blank" rel="noopener noreferrer"
                  className="w-full py-3 bg-primary text-black rounded-xl text-sm font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2">
                  <ExternalLink className="w-4 h-4" /> Open Dodo Checkout
                </a>
                <button onClick={() => this.setState({ result: null })} className="w-full py-2 text-xs text-gray-500 hover:text-white transition-colors font-semibold">
                  Back
                </button>
              </div>
            )}

            {/* ── Withdraw tab ── */}
            {tab === 'withdraw' && (
              <div className="py-8 flex flex-col items-center gap-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-400 mb-1">Withdraw funds</p>
                  <p className="text-xs text-gray-700">Connect your Solana wallet to withdraw USDC or tokens to your address.</p>
                </div>
                <button className="px-6 py-2.5 bg-primary/10 border border-primary/[0.20] text-primary text-xs font-semibold rounded-xl hover:bg-primary/20 transition-colors">
                  Connect Wallet First
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

// ── Portfolio View ─────────────────────────────────────────────────────────

interface PortfolioViewState {
  tab: PortfolioTab;
  showDeposit: boolean;
  depositInitialTab: DepositTab;
  portfolio: PortfolioData | null;
  positions: Position[];
  orders: Order[];
  trades: Trade[];
  funding: FundingPayment[];
  perfData: PerfPoint[];
  loading: boolean;
  perfLoading: boolean;
  jupPositions: JupPosition[];
  jupLoading: boolean;
}

const TABS: { key: PortfolioTab; label: string }[] = [
  { key: 'holdings',    label: 'Holdings'    },
  { key: 'positions',   label: 'Positions'   },
  { key: 'orders',      label: 'Open Orders' },
  { key: 'history',     label: 'History'     },
  { key: 'funding',     label: 'Funding'     },
  { key: 'predictions', label: 'Predictions' },
  { key: 'analytics',   label: 'Analytics'   },
];

interface PortfolioViewProps {
  eventPositions: EventPosition[];
  walletConnected: boolean;
  walletAddress: string | null;
  onOpenWallet: () => void;
}

class PortfolioView extends Component<PortfolioViewProps, PortfolioViewState> {
  override state: PortfolioViewState = {
    tab: 'holdings', showDeposit: false, depositInitialTab: 'deposit',
    portfolio: null, positions: [], orders: [], trades: [], funding: [],
    perfData: [], loading: true, perfLoading: true,
    jupPositions: [], jupLoading: false,
  };

  override componentDidMount() {
    const { walletConnected, walletAddress } = this.props;
    if (walletConnected && walletAddress) void this.fetchAll();
    else this.setState({ loading: false, perfLoading: false });
  }

  override componentDidUpdate(prevProps: PortfolioViewProps) {
    const { walletConnected, walletAddress } = this.props;
    const prevReady = prevProps.walletConnected && !!prevProps.walletAddress;
    const nowReady  = walletConnected && !!walletAddress;

    if (!nowReady && prevReady) {
      this.setState({
        portfolio: null, positions: [], orders: [], trades: [], funding: [],
        perfData: [], loading: false, perfLoading: false,
      });
      return;
    }

    if (nowReady && (!prevReady || prevProps.walletAddress !== walletAddress)) {
      void this.fetchAll();
    }
  }

  private async fetchAll() {
    const addr = this.props.walletAddress;
    if (!addr) return;
    const w = encodeURIComponent(addr);
    this.setState({ loading: true });
    const [portRes, posRes, ordRes, tradesRes, fundRes] = await Promise.allSettled([
      fetch(`${API_URL}/portfolio?wallet=${w}`).then((r) => r.json()),
      fetch(`${API_URL}/positions?wallet=${w}`).then((r) => r.json()),
      fetch(`${API_URL}/orders?wallet=${w}`).then((r) => r.json()),
      fetch(`${API_URL}/trades?wallet=${w}`).then((r) => r.json()),
      fetch(`${API_URL}/funding`).then((r) => r.json()),
    ]);
    this.setState({
      portfolio:  portRes.status   === 'fulfilled' ? portRes.value   as PortfolioData : null,
      positions:  posRes.status    === 'fulfilled' ? (posRes.value    as { positions: Position[] }).positions : [],
      orders:     ordRes.status    === 'fulfilled' ? (ordRes.value    as { orders: Order[] }).orders : [],
      trades:     tradesRes.status === 'fulfilled' ? (tradesRes.value as { trades: Trade[] }).trades : [],
      funding:    fundRes.status   === 'fulfilled' ? (fundRes.value   as { payments: FundingPayment[] }).payments : [],
      loading: false,
    });
    void this.fetchPerf('30d');
    void this.fetchJupPositions(addr);
  }

  private async fetchJupPositions(walletAddress: string) {
    this.setState({ jupLoading: true });
    try {
      const res  = await fetch(`${API_URL}/prediction/positions?wallet=${encodeURIComponent(walletAddress)}`);
      if (res.ok) {
        const data = (await res.json()) as { positions: JupPosition[] };
        this.setState({ jupPositions: data.positions ?? [], jupLoading: false });
      } else {
        this.setState({ jupPositions: [], jupLoading: false });
      }
    } catch {
      this.setState({ jupPositions: [], jupLoading: false });
    }
  }

  private async fetchPerf(range: PerfRange) {
    const addr = this.props.walletAddress;
    if (!addr) return;
    const w = encodeURIComponent(addr);
    this.setState({ perfLoading: true });
    try {
      const res  = await fetch(`${API_URL}/portfolio/performance?wallet=${w}&range=${range}`);
      const data = (await res.json()) as { performance: PerfPoint[] };
      this.setState({ perfData: data.performance, perfLoading: false });
    } catch { this.setState({ perfLoading: false }); }
  }

  private fmt = (v: number, d = 2) =>
    v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

  // ── Summary cards ──
  private renderSummaryCards() {
    const { portfolio, loading } = this.state;
    const cards: { label: string; value: string; sub: string; subCls: string; valCls?: string }[] = [
      {
        label: 'Total Value',
        value: portfolio ? `$${this.fmt(portfolio.totalValue)}` : '—',
        sub: portfolio ? `${portfolio.pnl24h >= 0 ? '+' : ''}${this.fmt(portfolio.pnl24hPct)}% today` : '',
        subCls: portfolio && portfolio.pnl24h >= 0 ? 'text-success' : 'text-error',
      },
      {
        label: '24h PnL',
        value: portfolio ? `${portfolio.pnl24h >= 0 ? '+' : ''}$${Math.abs(portfolio.pnl24h).toFixed(2)}` : '—',
        sub: 'unrealized change',
        subCls: 'text-gray-600',
        valCls: portfolio && portfolio.pnl24h >= 0 ? 'text-success' : 'text-error',
      },
      {
        label: 'Realized PnL',
        value: portfolio ? `+$${this.fmt(portfolio.realizedPnl)}` : '—',
        sub: 'all time', subCls: 'text-gray-600', valCls: 'text-success',
      },
      {
        label: 'Available Margin',
        value: portfolio ? `$${this.fmt(portfolio.availableMargin)}` : '—',
        sub: portfolio ? `$${this.fmt(portfolio.marginUsed)} used` : '',
        subCls: 'text-gray-600',
      },
    ];
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="glass-card p-4">
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider mb-1.5">{c.label}</p>
            {loading
              ? <div className="h-7 w-24 bg-white/[0.04] rounded animate-pulse mb-1" />
              : <p className={cn('text-2xl font-bold font-mono', c.valCls)}>{c.value}</p>}
            <p className={cn('text-[10px] mt-0.5', c.subCls)}>{c.sub}</p>
          </div>
        ))}
      </div>
    );
  }

  // ── Risk bar ──
  private renderRiskBar() {
    const { portfolio, positions } = this.state;
    if (!portfolio) return null;
    const h = portfolio.accountHealth;
    const hCls = h > 70 ? 'bg-success' : h > 40 ? 'bg-warning' : 'bg-error';
    const hTxt = h > 70 ? 'text-success' : h > 40 ? 'text-warning' : 'text-error';
    return (
      <div className="glass-card px-4 py-3 flex items-center gap-6 flex-wrap text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Account Health</span>
          <div className="w-24 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', hCls)} style={{ width: `${h}%` }} />
          </div>
          <span className={cn('font-mono font-bold', hTxt)}>{h}%</span>
        </div>
        <span className="text-gray-600">Margin Used: <span className="text-white font-mono">${this.fmt(portfolio.marginUsed)}</span></span>
        <span className="text-gray-600">Avg Leverage: <span className="text-white font-mono">{portfolio.avgLeverage}x</span></span>
        <span className="text-gray-600">Open Positions: <span className="text-white font-mono">{positions.length}</span></span>
      </div>
    );
  }

  // ── Holdings tab ──
  private renderHoldings() {
    const { portfolio, loading } = this.state;
    const holdings = portfolio?.holdings ?? [];
    const total    = portfolio?.totalValue ?? 1;
    const Skel = () => (
      <tr>{Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-white/[0.04] rounded animate-pulse w-20 ml-auto first:ml-0" />
        </td>
      ))}</tr>
    );
    return (
      <div className="glass-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-primary/[0.06]">
              {['Asset', 'Balance', 'Avg Cost', 'Value', '24h', 'Allocation'].map((h) => (
                <th key={h} className={cn('px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-600', h === 'Asset' ? 'text-left' : 'text-right')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <Skel key={i} />)
              : holdings.map((h) => {
                  const pos = h.change24h >= 0;
                  const pct = ((h.usdValue / total) * 100).toFixed(1);
                  return (
                    <tr key={h.symbol} className="border-b border-primary/[0.04] hover:bg-primary/[0.03] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <CoinIcon symbol={h.symbol} size={32} />
                          <div>
                            <div className="text-sm font-bold">{h.symbol}</div>
                            <div className="text-[10px] text-gray-600">{h.amount.toLocaleString()} {h.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-sm">{h.amount.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-gray-500">${h.avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3.5 text-right font-mono text-sm font-bold">${this.fmt(h.usdValue)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={cn('text-xs font-mono font-bold inline-flex items-center gap-0.5', pos ? 'text-success' : 'text-error')}>
                          {pos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {pos ? '+' : ''}{h.change24h.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-16 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                            <div className="h-full bg-primary/50 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-gray-600 w-10 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Positions tab ──
  private renderPositions() {
    const { positions, loading } = this.state;
    if (loading) return <Spinner />;
    if (!positions.length) return <EmptyState icon={Activity} label="No open positions" sub="Start trading to see positions here" />;
    const headers = ['Market', 'Side', 'Size', 'Entry', 'Mark', 'Unr. PnL', 'Liq. Price', 'Margin', 'Lev.'];
    return (
      <div className="glass-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-primary/[0.06]">
              {headers.map((h) => (
                <th key={h} className={cn('px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-600 whitespace-nowrap', h === 'Market' ? 'text-left' : 'text-right')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const pnlPos = p.unrealizedPnl >= 0;
              return (
                <tr key={p.id} className="border-b border-primary/[0.04] hover:bg-primary/[0.03] transition-colors">
                  <td className="px-3 py-3.5 font-mono text-sm font-bold">{p.market}</td>
                  <td className="px-3 py-3.5 text-right"><SideBadge side={p.side} /></td>
                  <td className="px-3 py-3.5 text-right font-mono text-xs">{p.size.toLocaleString()}</td>
                  <td className="px-3 py-3.5 text-right font-mono text-xs text-gray-500">${this.fmt(p.entryPrice)}</td>
                  <td className="px-3 py-3.5 text-right font-mono text-xs">${this.fmt(p.markPrice)}</td>
                  <td className="px-3 py-3.5 text-right">
                    <div className={cn('font-mono text-xs font-bold', pnlPos ? 'text-success' : 'text-error')}>
                      {pnlPos ? '+' : ''}${Math.abs(p.unrealizedPnl).toFixed(2)}
                    </div>
                    <div className={cn('text-[10px] font-mono', pnlPos ? 'text-success/60' : 'text-error/60')}>
                      {pnlPos ? '+' : ''}{p.unrealizedPnlPct.toFixed(2)}%
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-xs text-error/70">${this.fmt(p.liquidationPrice)}</td>
                  <td className="px-3 py-3.5 text-right font-mono text-xs text-gray-500">${this.fmt(p.margin)}</td>
                  <td className="px-3 py-3.5 text-right font-mono text-xs">{p.leverage}x</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Orders tab ──
  private renderOrders() {
    const { orders, loading } = this.state;
    if (loading) return <Spinner />;
    if (!orders.length) return <EmptyState icon={Activity} label="No open orders" sub="Limit and TP/SL orders appear here" />;
    return (
      <div className="glass-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-primary/[0.06]">
              {['Market', 'Side', 'Type', 'Price', 'Size', 'Filled', 'Status', 'Time'].map((h) => (
                <th key={h} className={cn('px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-600', h === 'Market' ? 'text-left' : 'text-right')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-primary/[0.04] hover:bg-primary/[0.03] transition-colors">
                <td className="px-3 py-3 font-mono text-sm font-bold">{o.market}</td>
                <td className="px-3 py-3 text-right"><SideBadge side={o.side} /></td>
                <td className="px-3 py-3 text-right font-mono text-xs capitalize text-gray-500">{o.type}</td>
                <td className="px-3 py-3 text-right font-mono text-xs">${this.fmt(o.price)}</td>
                <td className="px-3 py-3 text-right font-mono text-xs">{o.size}</td>
                <td className="px-3 py-3 text-right font-mono text-xs text-gray-500">{o.filled}</td>
                <td className="px-3 py-3 text-right">
                  <span className="text-[10px] font-bold text-warning bg-warning/10 px-2 py-0.5 rounded capitalize">{o.status}</span>
                </td>
                <td className="px-3 py-3 text-right font-mono text-[10px] text-gray-600">{new Date(o.createdAt).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── History tab ──
  private renderHistory() {
    const { trades, loading } = this.state;
    if (loading) return <Spinner />;
    if (!trades.length) return <EmptyState icon={Activity} label="No trade history" sub="Completed trades appear here" />;
    return (
      <div className="glass-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-primary/[0.06]">
              {['Time', 'Market', 'Side', 'Size', 'Price', 'Notional', 'Fee', 'PnL', 'Tx'].map((h) => (
                <th key={h} className={cn('px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-600', h === 'Time' ? 'text-left' : 'text-right')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => {
              const pnlPos = t.realizedPnl != null && t.realizedPnl >= 0;
              return (
                <tr key={t.id} className="border-b border-primary/[0.04] hover:bg-primary/[0.03] transition-colors">
                  <td className="px-3 py-3 font-mono text-[10px] text-gray-600 whitespace-nowrap">{new Date(t.timestamp).toLocaleString()}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs font-bold">{t.market}</td>
                  <td className="px-3 py-3 text-right"><SideBadge side={t.side} /></td>
                  <td className="px-3 py-3 text-right font-mono text-xs">{t.size.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs">${this.fmt(t.price)}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs">${this.fmt(t.notional)}</td>
                  <td className="px-3 py-3 text-right font-mono text-[10px] text-gray-600">${t.fee.toFixed(4)}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs">
                    {t.realizedPnl != null
                      ? <span className={pnlPos ? 'text-success' : 'text-error'}>{pnlPos ? '+' : ''}${Math.abs(t.realizedPnl).toFixed(2)}</span>
                      : <span className="text-gray-700">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="font-mono text-[10px] text-primary/50 hover:text-primary cursor-pointer transition-colors">{t.signature}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Funding tab ──
  private renderFunding() {
    const { funding, loading } = this.state;
    if (loading) return <Spinner />;
    if (!funding.length) return <EmptyState icon={Activity} label="No funding payments" sub="Funding is collected every 8 hours for open positions" />;
    const total = funding.reduce((s, f) => s + f.payment, 0);
    return (
      <div className="space-y-3">
        <div className="glass-card px-4 py-3 flex items-center gap-6 text-[11px] flex-wrap">
          <span className="text-gray-600">
            Total Funding:{' '}
            <span className={cn('font-mono font-bold', total >= 0 ? 'text-success' : 'text-error')}>
              {total >= 0 ? '+' : ''}${Math.abs(total).toFixed(4)}
            </span>
          </span>
          <span className="text-gray-600">Next collection: <span className="font-mono text-white">5h 42m</span></span>
        </div>
        <div className="glass-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-primary/[0.06]">
                {['Time', 'Market', 'Side', 'Rate', 'Payment'].map((h) => (
                  <th key={h} className={cn('px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-600', h === 'Time' ? 'text-left' : 'text-right')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {funding.map((f) => {
                const received = f.payment >= 0;
                return (
                  <tr key={f.id} className="border-b border-primary/[0.04] hover:bg-primary/[0.03] transition-colors">
                    <td className="px-4 py-3 font-mono text-[10px] text-gray-600 whitespace-nowrap">{new Date(f.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold">{f.market}</td>
                    <td className="px-4 py-3 text-right"><SideBadge side={f.side} /></td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">{f.rate.toFixed(4)}%</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('font-mono text-xs font-bold', received ? 'text-success' : 'text-error')}>
                        {received ? '+' : ''}${f.payment.toFixed(4)}
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

  // ── Analytics tab ──
  private renderAnalytics() {
    const { portfolio, positions } = this.state;
    const metrics: { label: string; value: string; note: string; valCls?: string }[] = [
      { label: 'Margin Ratio',    value: portfolio ? `${((portfolio.marginUsed / portfolio.totalValue) * 100).toFixed(1)}%` : '—', note: 'of total value' },
      { label: 'Avg Leverage',    value: `${portfolio?.avgLeverage ?? '—'}x`, note: 'across positions' },
      { label: 'Open Positions',  value: `${positions.length}`, note: 'perp contracts' },
      { label: 'Total Notional',  value: portfolio ? `$${this.fmt(positions.reduce((s, p) => s + p.notional, 0))}` : '—', note: 'gross exposure' },
      { label: 'Net Unrealized',  value: portfolio ? `+$${this.fmt(portfolio.unrealizedPnl)}` : '—', note: 'mark to market', valCls: 'text-success' },
      { label: 'Realized PnL',    value: portfolio ? `+$${this.fmt(portfolio.realizedPnl)}` : '—', note: 'all time', valCls: 'text-success' },
    ];
    return (
      <div className="space-y-4">
        <div className="glass-card p-4 border border-accent/[0.15] bg-accent/[0.03]">
          <div className="flex items-center gap-2 mb-3">
            <BrainCircuit className="w-4 h-4 text-accent" />
            <span className="text-[10px] font-bold text-accent uppercase tracking-wider">AI Copilot</span>
          </div>
          <p className="text-[12px] text-gray-300 leading-relaxed mb-2">
            You have <span className="text-white font-semibold">2 open perp positions</span> with a net long bias (SOL long, ETH short partially hedges).
            Unrealized PnL: <span className="text-success font-semibold">+$41.43</span>.
            Account health is <span className="text-success font-semibold">87% — healthy</span>.
          </p>
          <p className="text-[11px] text-gray-600">
            SOL and ETH have ~0.72 correlation. Your short ETH partially offsets SOL downside risk.
            Consider reducing leverage if expecting broad market volatility this week.
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="glass-card p-4">
              <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider mb-1">{m.label}</p>
              <p className={cn('text-xl font-bold font-mono', m.valCls)}>{m.value}</p>
              <p className="text-[10px] text-gray-700 mt-0.5">{m.note}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Predictions tab ──
  private renderPredictions() {
    const { eventPositions } = this.props;
    const { jupPositions, jupLoading } = this.state;
    const hasAny = eventPositions.length > 0 || jupPositions.length > 0 || jupLoading;
    if (!hasAny) {
      return <EmptyState icon={Layers} label="No prediction positions" sub="Trade on events in the Prediction Markets tab to see positions here" />;
    }
    return (
      <div className="space-y-4">

        {/* Jupiter positions (on-chain via Jupiter Prediction API) */}
        {(jupPositions.length > 0 || jupLoading) && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1">Jupiter Prediction · On-chain</p>
            {jupLoading && jupPositions.length === 0 && (
              <div className="glass-card p-4 animate-pulse h-20" />
            )}
            {jupPositions.map((pos) => {
              const micro = (v: string | null) => v ? parseInt(v, 10) / 1_000_000 : null;
              const cost    = micro(pos.totalCostUsd) ?? 0;
              const value   = micro(pos.valueUsd);
              const pnlUsd  = micro(pos.pnlUsd);
              const payout  = micro(pos.payoutUsd) ?? 0;
              const pnlPos  = (pnlUsd ?? 0) >= 0;
              const avgPrice = parseInt(pos.avgPriceUsd, 10) / 10_000; // micro USD → cents
              const contracts = parseInt(pos.contracts, 10);
              return (
                <div key={pos.pubkey} className="glass-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{pos.eventMetadata.category}</p>
                      <p className="text-sm font-semibold leading-snug truncate">{pos.eventMetadata.title}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">{pos.marketMetadata.title}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      {pnlUsd !== null && (
                        <p className={cn('text-sm font-bold font-mono', pnlPos ? 'text-success' : 'text-error')}>
                          {pnlPos ? '+' : ''}${pnlUsd.toFixed(2)}
                        </p>
                      )}
                      {pos.claimable && (
                        <span className="inline-block text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
                          Claimable
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className={cn('rounded-lg px-3 py-2.5 border', pos.isYes ? 'bg-success/[0.06] border-success/[0.12]' : 'bg-error/[0.06] border-error/[0.12]')}>
                      <p className={cn('text-[10px] font-bold uppercase tracking-wider mb-1', pos.isYes ? 'text-success/70' : 'text-error/70')}>
                        {pos.isYes ? 'YES' : 'NO'}
                      </p>
                      <p className={cn('text-sm font-mono font-bold', pos.isYes ? 'text-success' : 'text-error')}>
                        {contracts} contracts
                      </p>
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        avg {avgPrice.toFixed(1)}¢ · cost ${cost.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2.5">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Payout if wins</p>
                      <p className="text-sm font-mono font-bold text-white">${payout.toFixed(2)}</p>
                      {value !== null && (
                        <p className="text-[10px] text-gray-600 mt-0.5">mark ${value.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Kaido native LMSR positions */}
        {eventPositions.length > 0 && (
          <div className="space-y-3">
            {jupPositions.length > 0 && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1">Kaido Native Events</p>
            )}
            {eventPositions.map((pos) => {
          const yesVal  = pos.yesValue;
          const noVal   = pos.noValue;
          const cost    = pos.yesCost + pos.noCost;
          const val     = yesVal + noVal;
          const pnl     = val - cost;
          const pnlPos  = pnl >= 0;
          const resDate = new Date(pos.resolutionDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          return (
            <div key={pos.eventId} className="glass-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{pos.category}</p>
                  <p className="text-sm font-semibold leading-snug">{pos.title}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold font-mono ${pnlPos ? 'text-success' : 'text-error'}`}>
                    {pnlPos ? '+' : ''}${pnl.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-600">unrealized PnL</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {pos.yesShares > 0 && (
                  <div className="bg-success/[0.06] border border-success/[0.12] rounded-lg px-3 py-2.5">
                    <p className="text-[10px] font-bold text-success/70 uppercase tracking-wider mb-1">YES</p>
                    <p className="text-sm font-mono font-bold text-success">{pos.yesShares.toFixed(2)} shares</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      @ {(pos.yesPrice * 100).toFixed(1)}¢ · val ${yesVal.toFixed(2)}
                    </p>
                  </div>
                )}
                {pos.noShares > 0 && (
                  <div className="bg-error/[0.06] border border-error/[0.12] rounded-lg px-3 py-2.5">
                    <p className="text-[10px] font-bold text-error/70 uppercase tracking-wider mb-1">NO</p>
                    <p className="text-sm font-mono font-bold text-error">{pos.noShares.toFixed(2)} shares</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      @ {(pos.noPrice * 100).toFixed(1)}¢ · val ${noVal.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] text-gray-600 pt-1 border-t border-primary/[0.06]">
                <span>Cost basis: <span className="text-white font-mono">${cost.toFixed(2)}</span></span>
                <span>Current value: <span className="text-white font-mono">${val.toFixed(2)}</span></span>
                <span>Resolves: <span className="text-white">{resDate}</span></span>
              </div>
            </div>
          );
        })}
          </div>
        )}

      </div>
    );
  }

  override render() {
    const { tab, showDeposit, depositInitialTab, portfolio, perfData, perfLoading } = this.state;
    const { walletConnected, walletAddress, onOpenWallet } = this.props;

    if (!walletConnected || !walletAddress) {
      return (
        <div className="flex flex-col items-center justify-center py-28 gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/[0.15] flex items-center justify-center">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold font-heading mb-2">Connect Your Wallet</h2>
            <p className="text-sm text-gray-500">Connect your Solana wallet to view your portfolio, positions, and history</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onOpenWallet()}
              className="px-6 py-2.5 bg-primary text-black rounded-xl text-sm font-semibold hover:brightness-110 transition-all"
            >
              Connect Wallet
            </button>
            <button
              type="button"
              onClick={() => this.setState({ showDeposit: true, depositInitialTab: 'deposit' })}
              className="px-6 py-2.5 bg-white/[0.05] border border-white/[0.08] text-gray-300 rounded-xl text-sm font-semibold hover:bg-white/[0.08] transition-all"
            >
              Deposit Funds
            </button>
          </div>
          {showDeposit && <DepositModal initialTab={depositInitialTab} onClose={() => this.setState({ showDeposit: false })} />}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading">Portfolio</h1>
            <p className="text-sm text-gray-600 mt-0.5">
              {portfolio ? `$${this.fmt(portfolio.totalValue)} total · ${portfolio.pnl24h >= 0 ? '+' : ''}$${Math.abs(portfolio.pnl24h).toFixed(2)} today` : 'Loading…'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => this.setState({ showDeposit: true, depositInitialTab: 'deposit' })}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-xl text-xs font-semibold hover:brightness-110 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Deposit
            </button>
            <button
              onClick={() => this.setState({ showDeposit: true, depositInitialTab: 'withdraw' })}
              className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] border border-white/[0.08] text-gray-300 rounded-xl text-xs font-semibold hover:bg-white/[0.08] transition-all"
            >
              <Upload className="w-3.5 h-3.5" /> Withdraw
            </button>
          </div>
        </div>

        {this.renderSummaryCards()}
        {portfolio && this.renderRiskBar()}

        <PerformanceChart
          data={perfData}
          loading={perfLoading}
          onRangeChange={(r) => void this.fetchPerf(r)}
        />

        {/* Tabs */}
        <div className="flex border-b border-primary/[0.08] overflow-x-auto scrollbar-hide">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => this.setState({ tab: t.key })}
              className={cn('px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors relative shrink-0', tab === t.key ? 'text-white' : 'text-gray-600 hover:text-gray-400')}
            >
              {t.label}
              {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />}
            </button>
          ))}
        </div>

        {tab === 'holdings'    && this.renderHoldings()}
        {tab === 'positions'   && this.renderPositions()}
        {tab === 'orders'      && this.renderOrders()}
        {tab === 'history'     && this.renderHistory()}
        {tab === 'funding'     && this.renderFunding()}
        {tab === 'predictions' && this.renderPredictions()}
        {tab === 'analytics'   && this.renderAnalytics()}

        {showDeposit && (
          <DepositModal initialTab={depositInitialTab} onClose={() => this.setState({ showDeposit: false })} />
        )}
      </div>
    );
  }
}

// ── Spinner ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="glass-card p-10 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const eventPositions   = useKaidoStore((s) => s.eventPositions);
  const wallet           = useKaidoStore((s) => s.wallet);
  const setWalletModalOpen = useKaidoStore((s) => s.setWalletModalOpen);
  const walletConnected  = wallet.connected && !!wallet.publicKey;
  return (
    <div className="min-h-screen flex flex-col bg-background text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-hide">
        <div className="max-w-7xl mx-auto">
          <PortfolioView
            eventPositions={eventPositions}
            walletConnected={walletConnected}
            walletAddress={wallet.publicKey}
            onOpenWallet={() => setWalletModalOpen(true)}
          />
        </div>
      </main>
      <StatusBar />
    </div>
  );
}
