'use client';

import { Component } from 'react';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { Navbar } from '../../components/Navbar';
import { StatusBar } from '../../components/StatusBar';
import { Clock, TrendingUp, ChevronDown, ChevronUp, Loader2, ExternalLink, Search, X, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useKaidoStore } from '../../store';

const API_URL   = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const GAMMA_API = 'https://gamma-api.polymarket.com';
// Prediction market txs settle on Solana mainnet
const MAINNET_RPC = process.env['NEXT_PUBLIC_MAINNET_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventSubtopic {
  id:               string;
  question:         string;
  yesPrice:         number;   // 0–1
  noPrice:          number;
  volume:           number;
  endDate:          string;
  source:           'polymarket';
  url?:             string;
  jupiterMarketId?: string;   // present when Jupiter key configured
  buyYesPriceUsd?:  number;  // micro USD
  buyNoPriceUsd?:   number;
}

interface EventTopic {
  id:        string;
  title:     string;
  category:  string;
  source:    'polymarket';
  volume:    number;
  liquidity: number;
  endDate:   string;
  subtopics: EventSubtopic[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  if (n > 0)          return `$${n}`;
  return '—';
}

function daysUntil(dateStr: string): string {
  if (!dateStr) return '—';
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const d = Math.ceil(diff / 86_400_000);
  if (d === 1) return '1d';
  if (d < 30) return `${d}d`;
  return `${Math.round(d / 30)}mo`;
}

// ── Gamma fallback (client-side, no backend) ──────────────────────────────────

interface GammaMarket {
  id:             string;
  question?:      string;
  outcomePrices?: string;
  volume?:        number | string;
  endDate?:       string;
  active?:        boolean;
  closed?:        boolean;
  clobTokenIds?:  string;
  conditionId?:   string;
}
interface GammaEvent {
  id:         string;
  title:      string;
  slug?:      string;
  category?:  string;
  endDate?:   string;
  volume?:    number | string;
  liquidity?: number | string;
  markets?:   GammaMarket[];
  tags?:      Array<{ label?: string }>;
}

function parseNum(v: number | string | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v as string);
  return Number.isFinite(n) ? n : 0;
}
function parseYesPrice(op: string | undefined): number {
  try {
    const arr = JSON.parse(op ?? '[]') as unknown[];
    const raw = typeof arr[0] === 'string' ? parseFloat(arr[0]) : Number(arr[0]);
    if (Number.isFinite(raw)) return +Math.max(0.01, Math.min(0.99, raw)).toFixed(4);
  } catch { /**/ }
  return 0.5;
}

async function fetchGammaFallback(limit: number): Promise<{ topics: EventTopic[]; categories: string[]; tradingEnabled: boolean }> {
  const params = new URLSearchParams({ active: 'true', closed: 'false', limit: String(Math.min(limit * 2, 100)), order: 'volume', ascending: 'false' });
  const res = await fetch(`${GAMMA_API}/events?${params}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`Gamma ${res.status}`);
  const data = (await res.json()) as GammaEvent[];
  const events = Array.isArray(data) ? data : [];

  const topics = events
    .filter((e) => e.title && (e.markets?.length ?? 0) > 0)
    .map((e): EventTopic => {
      const active = (e.markets ?? []).filter((m) => m.active !== false && m.closed !== true);
      const src = active.length > 0 ? active : (e.markets ?? []).slice(0, 1);
      const subtopics: EventSubtopic[] = src.map((m): EventSubtopic => {
        const yesPrice = parseYesPrice(m.outcomePrices);
        return { id: `poly_${m.id}`, question: m.question ?? e.title, yesPrice, noPrice: +(1 - yesPrice).toFixed(4), volume: parseNum(m.volume), endDate: m.endDate ?? e.endDate ?? '', source: 'polymarket', url: `https://polymarket.com/event/${e.slug ?? e.id}` };
      });
      return { id: `poly_${e.id}`, title: e.title, category: e.category ?? e.tags?.[0]?.label ?? 'Other', source: 'polymarket', volume: parseNum(e.volume), liquidity: parseNum(e.liquidity), endDate: e.endDate ?? '', subtopics };
    })
    .filter((t) => t.subtopics.length > 0)
    .slice(0, limit);

  const categories = ['All', ...new Set(topics.map((t) => t.category))].sort();
  return { topics, categories, tradingEnabled: false };
}

async function loadEvents(limit: number, category?: string): Promise<{ topics: EventTopic[]; categories: string[]; tradingEnabled: boolean }> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (category && category !== 'All') params.set('category', category);
    const res = await fetch(`${API_URL}/prediction/events?${params}`, { signal: AbortSignal.timeout(14_000) });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = (await res.json()) as { topics: EventTopic[]; categories: string[]; tradingEnabled: boolean };
    // Backend couldn't reach Gamma server-side (empty but OK) — fall back to direct browser fetch
    if (!data.tradingEnabled && (!data.topics || data.topics.length === 0)) {
      return fetchGammaFallback(limit);
    }
    return { topics: data.topics ?? [], categories: data.categories ?? ['All'], tradingEnabled: data.tradingEnabled ?? false };
  } catch {
    // Backend down — fetch directly from Gamma (read-only, no trading)
    return fetchGammaFallback(limit);
  }
}

// ── Buy Modal ─────────────────────────────────────────────────────────────────

interface BuyModalProps {
  market:       EventSubtopic;
  side:         'yes' | 'no';
  walletKey:    string;
  onClose:      () => void;
  onToast:      (t: { type: 'success' | 'error' | 'pending'; title: string; message?: string; signature?: string }) => void;
}
interface BuyModalState {
  amount:      string;
  submitting:  boolean;
  error:       string | null;
}

class BuyModal extends Component<BuyModalProps, BuyModalState> {
  override state: BuyModalState = { amount: '5', submitting: false, error: null };

  private contracts(): string {
    const { side, market } = this.props;
    const priceUsd = side === 'yes' ? (market.buyYesPriceUsd ?? market.yesPrice * 1_000_000) : (market.buyNoPriceUsd ?? market.noPrice * 1_000_000);
    const prob = priceUsd / 1_000_000;
    const amt  = parseFloat(this.state.amount) || 0;
    if (prob <= 0) return '0';
    return (amt / prob).toFixed(0);
  }

  private handleBuy = async () => {
    const { market, side, walletKey, onClose, onToast } = this.props;
    const amountUsd = parseFloat(this.state.amount);
    if (!amountUsd || amountUsd < 0.01) { this.setState({ error: 'Enter a valid amount (min $0.01)' }); return; }
    if (!market.jupiterMarketId) { this.setState({ error: 'Trading not available for this market' }); return; }

    this.setState({ submitting: true, error: null });
    onToast({ type: 'pending', title: 'Building order…' });

    try {
      // 1. Get unsigned tx from backend
      const orderRes = await fetch(`${API_URL}/prediction/orders`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ownerPubkey: walletKey, marketId: market.jupiterMarketId, isYes: side === 'yes', amountUsd }),
      });
      if (!orderRes.ok) {
        const err = (await orderRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Order failed (${orderRes.status})`);
      }
      const { transaction } = (await orderRes.json()) as { transaction: string };

      // 2. Deserialize base64 tx
      const txBytes = Uint8Array.from(atob(transaction), (c) => c.charCodeAt(0));
      const vtx     = VersionedTransaction.deserialize(txBytes);

      // 3. Sign with wallet
      const wallet = (window as unknown as { solana?: { signTransaction?: (t: unknown) => Promise<unknown> } }).solana;
      if (!wallet?.signTransaction) throw new Error('Wallet not connected or does not support signing');
      const signed = (await wallet.signTransaction(vtx)) as VersionedTransaction;

      // 4. Submit to mainnet
      const connection = new Connection(MAINNET_RPC, 'confirmed');
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });

      onToast({ type: 'success', title: `Bought ${this.contracts()} ${side.toUpperCase()} contracts`, message: `$${amountUsd} · ${market.question.slice(0, 40)}`, signature: sig });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.setState({ submitting: false, error: msg });
      onToast({ type: 'error', title: 'Order failed', message: msg });
    }
  };

  override render() {
    const { market, side, onClose } = this.props;
    const { amount, submitting, error } = this.state;
    const isYes    = side === 'yes';
    const priceUsd = isYes ? (market.buyYesPriceUsd ?? market.yesPrice * 1_000_000) : (market.buyNoPriceUsd ?? market.noPrice * 1_000_000);
    const priceCents = (priceUsd / 10_000).toFixed(1); // micro USD / 10_000 = cents
    const contracts = this.contracts();
    const payout    = parseFloat(contracts) || 0;

    return (
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative glass-card w-full max-w-sm p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Jupiter Prediction</span>
              </div>
              <p className="text-xs font-semibold text-white leading-snug line-clamp-2">{market.question}</p>
            </div>
            <button onClick={onClose} className="shrink-0 p-1 text-gray-600 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Side selector */}
          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <div className={cn('p-3 rounded-xl border text-center', isYes ? 'bg-green-500/15 border-green-500/40 text-green-400' : 'border-white/[0.06] text-gray-600')}>
              <div className="text-[10px] uppercase tracking-wide mb-0.5">BUY YES</div>
              <div className="font-mono text-base">{(market.yesPrice * 100).toFixed(0)}¢</div>
            </div>
            <div className={cn('p-3 rounded-xl border text-center', !isYes ? 'bg-red-500/15 border-red-500/40 text-red-400' : 'border-white/[0.06] text-gray-600')}>
              <div className="text-[10px] uppercase tracking-wide mb-0.5">BUY NO</div>
              <div className="font-mono text-base">{(market.noPrice * 100).toFixed(0)}¢</div>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Amount (USDC)</label>
            <div className="flex items-center gap-2 glass rounded-xl px-3 py-2.5">
              <span className="text-gray-600 text-sm font-mono">$</span>
              <input
                type="number"
                min="0.01"
                step="1"
                value={amount}
                onChange={(e) => this.setState({ amount: e.target.value, error: null })}
                className="flex-1 bg-transparent text-white text-sm font-mono outline-none"
                placeholder="5.00"
              />
              <span className="text-[10px] text-gray-600 font-mono">USDC</span>
            </div>
            <div className="flex gap-1.5 mt-2">
              {['1', '5', '10', '25'].map((v) => (
                <button key={v} onClick={() => this.setState({ amount: v })}
                  className="flex-1 text-[10px] font-semibold py-1 rounded-lg glass text-gray-400 hover:text-white transition-colors">
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="glass rounded-xl p-3 space-y-1.5 text-[11px]">
            <div className="flex justify-between text-gray-500">
              <span>Price per contract</span>
              <span className="font-mono text-white">{priceCents}¢</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>You receive</span>
              <span className={cn('font-mono font-bold', isYes ? 'text-green-400' : 'text-red-400')}>{contracts} {side.toUpperCase()} contracts</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Max payout ({side.toUpperCase()} wins)</span>
              <span className="font-mono text-white">${payout.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500 border-t border-white/[0.04] pt-1.5 mt-1">
              <span>Settlement</span>
              <span className="text-gray-400">On-chain · no payout fees</span>
            </div>
          </div>

          {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}

          <button
            onClick={() => void this.handleBuy()}
            disabled={submitting || !amount}
            className={cn(
              'w-full py-3 rounded-xl text-sm font-bold transition-all',
              isYes
                ? 'bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30 disabled:opacity-40'
                : 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 disabled:opacity-40',
            )}
          >
            {submitting ? 'Submitting…' : `Buy ${side.toUpperCase()} · $${amount || '0'}`}
          </button>
        </div>
      </div>
    );
  }
}

// ── Subtopic Row ──────────────────────────────────────────────────────────────

interface SubtopicRowProps {
  s:              EventSubtopic;
  tradingEnabled: boolean;
  walletKey:      string | null;
  onBuy:          (s: EventSubtopic, side: 'yes' | 'no') => void;
  onOpenWallet:   () => void;
}

function SubtopicRow({ s, tradingEnabled, walletKey, onBuy, onOpenWallet }: SubtopicRowProps) {
  const canTrade = tradingEnabled && !!s.jupiterMarketId;

  const handleBuy = (side: 'yes' | 'no') => {
    if (!walletKey) { onOpenWallet(); return; }
    onBuy(s, side);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors border-b border-white/[0.03] last:border-0 group">
      {/* Question */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-300 leading-snug truncate">{s.question}</p>
        {s.endDate && (
          <p className="text-[10px] text-gray-600 mt-0.5 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 inline" />
            {daysUntil(s.endDate)} left
          </p>
        )}
      </div>

      {/* YES price */}
      <div className="text-center shrink-0 w-14">
        <div className="text-[10px] text-gray-600 mb-0.5">YES</div>
        <div className="text-sm font-bold font-mono text-green-400">{(s.yesPrice * 100).toFixed(0)}¢</div>
      </div>

      {/* NO price */}
      <div className="text-center shrink-0 w-14">
        <div className="text-[10px] text-gray-600 mb-0.5">NO</div>
        <div className="text-sm font-bold font-mono text-red-400">{(s.noPrice * 100).toFixed(0)}¢</div>
      </div>

      {/* Probability bar */}
      <div className="w-20 shrink-0">
        <div className="h-1 rounded-full bg-red-500/20 overflow-hidden">
          <div className="h-full bg-green-500/70 rounded-full" style={{ width: `${s.yesPrice * 100}%` }} />
        </div>
      </div>

      {/* Volume */}
      <div className="text-[11px] font-mono text-gray-500 shrink-0 w-16 text-right">
        {formatVolume(s.volume)}
      </div>

      {/* Buy buttons (Jupiter) or external link */}
      {canTrade ? (
        <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => handleBuy('yes')}
            className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors border border-green-500/20">
            YES
          </button>
          <button onClick={() => handleBuy('no')}
            className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors border border-red-500/20">
            NO
          </button>
        </div>
      ) : s.url ? (
        <a href={s.url} target="_blank" rel="noopener noreferrer"
          className="shrink-0 p-1 text-gray-700 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : <div className="w-5 shrink-0" />}
    </div>
  );
}

// ── Topic Card ────────────────────────────────────────────────────────────────

interface TopicCardProps {
  topic:          EventTopic;
  tradingEnabled: boolean;
  walletKey:      string | null;
  onBuy:          (s: EventSubtopic, side: 'yes' | 'no') => void;
  onOpenWallet:   () => void;
}
interface TopicCardState { expanded: boolean }

class TopicCard extends Component<TopicCardProps, TopicCardState> {
  override state: TopicCardState = { expanded: false };

  override render() {
    const { topic, tradingEnabled, walletKey, onBuy, onOpenWallet } = this.props;
    const { expanded } = this.state;

    return (
      <div className="glass-card overflow-hidden hover:border-white/10 transition-all">
        <button
          onClick={() => this.setState((s) => ({ expanded: !s.expanded }))}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
        >
          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">
            Polymarket
          </span>
          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/[0.05] text-gray-400 border border-white/[0.06]">
            {topic.category}
          </span>
          <span className="flex-1 min-w-0 text-sm font-semibold text-white leading-snug truncate">
            {topic.title}
          </span>
          <div className="shrink-0 flex items-center gap-3 text-[11px] text-gray-500">
            <span className="hidden sm:flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {formatVolume(topic.volume)}
            </span>
            <span className="bg-white/[0.05] rounded px-2 py-0.5 text-[10px] font-mono">
              {topic.subtopics.length} market{topic.subtopics.length !== 1 ? 's' : ''}
            </span>
          </div>
          <span className="shrink-0 text-gray-600">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {expanded && (
          <div className="border-t border-white/[0.05]">
            <div className="flex items-center gap-3 px-4 py-1.5 bg-black/20">
              <div className="flex-1 text-[9px] text-gray-600 uppercase tracking-wider">Market</div>
              <div className="w-14 text-[9px] text-gray-600 uppercase tracking-wider text-center">YES</div>
              <div className="w-14 text-[9px] text-gray-600 uppercase tracking-wider text-center">NO</div>
              <div className="w-20 text-[9px] text-gray-600 uppercase tracking-wider">Prob</div>
              <div className="w-16 text-[9px] text-gray-600 uppercase tracking-wider text-right">Volume</div>
              <div className="w-16 shrink-0" />
            </div>
            {topic.subtopics.map((s) => (
              <SubtopicRow key={s.id} s={s} tradingEnabled={tradingEnabled} walletKey={walletKey} onBuy={onBuy} onOpenWallet={onOpenWallet} />
            ))}
          </div>
        )}
      </div>
    );
  }
}

// ── Main Events View ──────────────────────────────────────────────────────────

interface EventsState {
  topics:         EventTopic[];
  categories:     string[];
  loading:        boolean;
  category:       string;
  search:         string;
  error:          string | null;
  tradingEnabled: boolean;
  buyMarket:      EventSubtopic | null;
  buySide:        'yes' | 'no';
}

interface EventsViewProps {
  walletKey:    string | null;
  addToast:     (t: { type: 'success' | 'error' | 'pending'; title: string; message?: string; signature?: string }) => void;
  onOpenWallet: () => void;
}

class EventsView extends Component<EventsViewProps, EventsState> {
  override state: EventsState = {
    topics: [], categories: ['All'], loading: true,
    category: 'All', search: '', error: null,
    tradingEnabled: false,
    buyMarket: null, buySide: 'yes',
  };

  private load(category: string) {
    this.setState({ loading: true, error: null });
    void loadEvents(60, category)
      .then(({ topics, categories, tradingEnabled }) =>
        this.setState({ topics, categories, loading: false, tradingEnabled }))
      .catch(() =>
        this.setState({ loading: false, error: 'Failed to load markets.' }));
  }

  override componentDidMount() { this.load('All'); }

  private handleCategory = (cat: string) => {
    this.setState({ category: cat });
    this.load(cat);
  };

  private handleBuy = (market: EventSubtopic, side: 'yes' | 'no') => {
    this.setState({ buyMarket: market, buySide: side });
  };

  override render() {
    const { walletKey, addToast, onOpenWallet } = this.props;
    const { topics, categories, loading, category, search, error, tradingEnabled, buyMarket, buySide } = this.state;

    const filtered = search.trim()
      ? topics.filter((t) =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.subtopics.some((s) => s.question.toLowerCase().includes(search.toLowerCase())))
      : topics;

    const totalMarkets = filtered.reduce((s, t) => s + t.subtopics.length, 0);

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading">Prediction Markets</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {tradingEnabled
                ? 'Live markets via Jupiter · click YES/NO to trade on Solana'
                : 'Live prediction markets from Polymarket'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tradingEnabled && (
              <div className="flex items-center gap-1.5 glass px-2.5 py-1.5 rounded-full text-[10px] font-semibold text-primary">
                <Zap className="w-3 h-3" /> Trading live
              </div>
            )}
            <div className="glass px-3 py-1.5 rounded-full text-[10px] font-mono text-gray-400">
              {totalMarkets} markets · {filtered.length} topics
            </div>
          </div>
        </div>

        {/* Category pills + search */}
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map((cat) => (
            <button key={cat} onClick={() => this.handleCategory(cat)}
              className={cn('px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all',
                category === cat ? 'bg-primary/80 text-black' : 'glass text-gray-400 hover:text-white')}>
              {cat}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 glass rounded-lg px-3 py-1.5">
            <Search className="w-3 h-3 text-gray-600" />
            <input value={search} onChange={(e) => this.setState({ search: e.target.value })}
              placeholder="Search topics…"
              className="bg-transparent text-xs text-white placeholder-gray-600 outline-none w-32" />
          </div>
        </div>

        {error && (
          <div className="glass-card p-4 border-red-500/20 text-sm text-red-400">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass-card p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-20 bg-white/5 rounded" />
                  <div className="h-4 w-16 bg-white/5 rounded" />
                  <div className="flex-1 h-4 bg-white/5 rounded" />
                  <div className="h-4 w-16 bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <Loader2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No markets found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((topic) => (
              <TopicCard key={topic.id} topic={topic}
                tradingEnabled={tradingEnabled} walletKey={walletKey}
                onBuy={this.handleBuy} onOpenWallet={onOpenWallet} />
            ))}
          </div>
        )}

        {buyMarket && walletKey && (
          <BuyModal
            market={buyMarket} side={buySide} walletKey={walletKey}
            onClose={() => this.setState({ buyMarket: null })}
            onToast={addToast} />
        )}
      </div>
    );
  }
}

// ── Page wrapper (reads store) ────────────────────────────────────────────────

function EventsPage() {
  const wallet           = useKaidoStore((s) => s.wallet);
  const addToast         = useKaidoStore((s) => s.addToast);
  const setWalletModalOpen = useKaidoStore((s) => s.setWalletModalOpen);

  return (
    <div className="min-h-screen flex flex-col bg-background text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-hide">
        <div className="max-w-5xl mx-auto">
          <EventsView
            walletKey={wallet.connected ? wallet.publicKey : null}
            addToast={addToast}
            onOpenWallet={() => setWalletModalOpen(true)}
          />
        </div>
      </main>
      <StatusBar />
    </div>
  );
}

export default EventsPage;
