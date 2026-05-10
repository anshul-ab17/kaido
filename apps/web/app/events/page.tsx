'use client';

import { Component } from 'react';
import { Navbar } from '../../components/Navbar';
import { StatusBar } from '../../components/StatusBar';
import { Clock, TrendingUp, ChevronDown, ChevronUp, Loader2, ExternalLink, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  if (n > 0) return `$${n}`;
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventSubtopic {
  id:        string;
  question:  string;
  yesPrice:  number;
  noPrice:   number;
  volume:    number;
  endDate:   string;
  source:    'polymarket' | 'kalshi';
  url?:      string;
}

interface EventTopic {
  id:        string;
  title:     string;
  category:  string;
  source:    'polymarket' | 'kalshi';
  volume:    number;
  liquidity: number;
  endDate:   string;
  subtopics: EventSubtopic[];
}

// ── Subtopic Row ──────────────────────────────────────────────────────────────

function SubtopicRow({ s }: { s: EventSubtopic }) {
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

      {/* External link */}
      {s.url && (
        <a href={s.url} target="_blank" rel="noopener noreferrer"
          className="shrink-0 p-1 text-gray-700 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

// ── Topic Card ────────────────────────────────────────────────────────────────

interface TopicCardProps { topic: EventTopic }
interface TopicCardState { expanded: boolean }

class TopicCard extends Component<TopicCardProps, TopicCardState> {
  override state: TopicCardState = { expanded: false };

  override render() {
    const { topic } = this.props;
    const { expanded } = this.state;
    const isPoly = topic.source === 'polymarket';

    return (
      <div className="glass-card overflow-hidden hover:border-white/10 transition-all">
        {/* Header — click to expand */}
        <button
          onClick={() => this.setState((s) => ({ expanded: !s.expanded }))}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
        >
          {/* Source badge */}
          <span className={cn(
            'shrink-0 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded',
            isPoly
              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
              : 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
          )}>
            {isPoly ? 'Polymarket' : 'Kalshi'}
          </span>

          {/* Category badge */}
          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/[0.05] text-gray-400 border border-white/[0.06]">
            {topic.category}
          </span>

          {/* Title */}
          <span className="flex-1 min-w-0 text-sm font-semibold text-white leading-snug truncate">
            {topic.title}
          </span>

          {/* Stats */}
          <div className="shrink-0 flex items-center gap-4 text-[11px] text-gray-500">
            <span className="hidden sm:flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {formatVolume(topic.volume)}
            </span>
            <span className="bg-white/[0.05] rounded px-2 py-0.5 text-[10px] font-mono">
              {topic.subtopics.length} market{topic.subtopics.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Chevron */}
          <span className="shrink-0 text-gray-600">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {/* Subtopics */}
        {expanded && (
          <div className="border-t border-white/[0.05]">
            {/* Column headers */}
            <div className="flex items-center gap-3 px-4 py-1.5 bg-black/20">
              <div className="flex-1 text-[9px] text-gray-600 uppercase tracking-wider">Market</div>
              <div className="w-14 text-[9px] text-gray-600 uppercase tracking-wider text-center">YES</div>
              <div className="w-14 text-[9px] text-gray-600 uppercase tracking-wider text-center">NO</div>
              <div className="w-20 text-[9px] text-gray-600 uppercase tracking-wider">Prob</div>
              <div className="w-16 text-[9px] text-gray-600 uppercase tracking-wider text-right">Volume</div>
              <div className="w-5" />
            </div>
            {topic.subtopics.map((s) => (
              <SubtopicRow key={s.id} s={s} />
            ))}
          </div>
        )}
      </div>
    );
  }
}

// ── Main Events View ──────────────────────────────────────────────────────────

type Source = 'all' | 'polymarket' | 'kalshi';

interface EventsState {
  topics:     EventTopic[];
  categories: string[];
  loading:    boolean;
  source:     Source;
  category:   string;
  search:     string;
  error:      string | null;
}

class EventsView extends Component<Record<string, never>, EventsState> {
  override state: EventsState = {
    topics: [], categories: ['All'], loading: true,
    source: 'all', category: 'All', search: '', error: null,
  };

  private load(source: Source, category: string) {
    this.setState({ loading: true, error: null });
    const params = new URLSearchParams({ source, limit: '60' });
    if (category !== 'All') params.set('category', category);

    void fetch(`${API_URL}/events/topics?${params.toString()}`)
      .then((r) => r.json() as Promise<{ topics: EventTopic[]; categories: string[] }>)
      .then((d) => this.setState({ topics: d.topics ?? [], categories: d.categories ?? ['All'], loading: false }))
      .catch(() => this.setState({ loading: false, error: 'Failed to load events. API may be unavailable.' }));
  }

  override componentDidMount() {
    this.load('all', 'All');
  }

  private handleSource = (source: Source) => {
    this.setState({ source, category: 'All' });
    this.load(source, 'All');
  };

  private handleCategory = (cat: string) => {
    this.setState({ category: cat });
    this.load(this.state.source, cat);
  };

  override render() {
    const { topics, categories, loading, source, category, search, error } = this.state;

    const filtered = search.trim()
      ? topics.filter((t) =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.subtopics.some((s) => s.question.toLowerCase().includes(search.toLowerCase()))
        )
      : topics;

    const totalMarkets = filtered.reduce((s, t) => s + t.subtopics.length, 0);

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading">Prediction Markets</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Live markets from Polymarket &amp; Kalshi
            </p>
          </div>
          <div className="glass px-3 py-1.5 rounded-full text-[10px] font-mono text-gray-400">
            {totalMarkets} markets · {filtered.length} topics
          </div>
        </div>

        {/* Source tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {([
            ['all',        'All Sources'],
            ['polymarket', 'Polymarket'],
            ['kalshi',     'Kalshi'],
          ] as const).map(([s, label]) => (
            <button
              key={s}
              onClick={() => this.handleSource(s)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                source === s ? 'bg-primary text-white' : 'glass text-gray-400 hover:text-white'
              )}
            >
              {s === 'polymarket' && (
                <svg viewBox="0 0 20 20" className="w-3 h-3 shrink-0" fill="currentColor">
                  <circle cx="10" cy="10" r="9" fill="#0072EB" />
                  <path d="M6 7h3.5a3 3 0 1 1 0 6H7v3H6V7Zm1 5h2.5a2 2 0 0 0 0-4H7v4Z" fill="white" />
                </svg>
              )}
              {s === 'kalshi' && (
                <svg viewBox="0 0 20 20" className="w-3 h-3 shrink-0" fill="none">
                  <rect width="20" height="20" rx="4" fill="#7C3AED" />
                  <path d="M5 5h2v10H5V5Zm4 4 4-4h2.5L11 10l4.5 5H13l-4-5v5H7V9h2Z" fill="white" />
                </svg>
              )}
              {label}
            </button>
          ))}
        </div>

        {/* Category pills + search */}
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => this.handleCategory(cat)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all',
                category === cat ? 'bg-primary/80 text-white' : 'glass text-gray-400 hover:text-white'
              )}
            >
              {cat}
            </button>
          ))}

          {/* Search */}
          <div className="ml-auto flex items-center gap-2 glass rounded-lg px-3 py-1.5">
            <Search className="w-3 h-3 text-gray-600" />
            <input
              value={search}
              onChange={(e) => this.setState({ search: e.target.value })}
              placeholder="Search topics…"
              className="bg-transparent text-xs text-white placeholder-gray-600 outline-none w-32"
            />
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="glass-card p-4 border-red-500/20 text-sm text-red-400">{error}</div>
        )}

        {/* Topics list */}
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
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </div>
        )}
      </div>
    );
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EventsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-white">
      <Navbar />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-hide">
        <div className="max-w-5xl mx-auto">
          <EventsView />
        </div>
      </main>
      <StatusBar />
    </div>
  );
}
