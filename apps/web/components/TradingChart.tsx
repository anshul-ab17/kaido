'use client';

import { Component, createRef } from 'react';
import {
  createChart, ColorType,
  CandlestickSeries, AreaSeries, HistogramSeries, BarSeries, LineSeries,
} from 'lightweight-charts';
import { cn } from '../lib/utils';
import { useKaidoStore } from '../store';
import { ChevronDown, Download, CandlestickChart, AreaChart, BarChart2 } from 'lucide-react';

type Timeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W';
type ChartType  = 'candle' | 'area' | 'bar';

const VISIBLE_TFS: Timeframe[] = ['5m', '1H', '1D'];
const MORE_TFS:   Timeframe[] = ['1m', '15m', '4H', '1W'];

const BINANCE_URL = 'https://api.binance.com/api/v3/klines';
const API_URL     = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const BINANCE_INTERVAL: Record<Timeframe, string> = {
  '1m': '1m', '5m': '5m', '15m': '15m',
  '1H': '1h', '4H': '4h', '1D': '1d', '1W': '1w',
};

const BINANCE_SYMBOL: Record<string, string> = {
  'SOL-PERP': 'SOLUSDT', 'BTC-PERP': 'BTCUSDT', 'ETH-PERP': 'ETHUSDT',
  'BNB-PERP': 'BNBUSDT', 'ARB-PERP': 'ARBUSDT', 'JUP-PERP': 'JUPUSDT',
};

const TF_INTERVAL: Record<Timeframe, number> = {
  '1m': 60, '5m': 300, '15m': 900,
  '1H': 3_600, '4H': 14_400, '1D': 86_400, '1W': 604_800,
};

const TF_LIMIT: Record<Timeframe, number> = {
  '1m': 300, '5m': 400, '15m': 400,
  '1H': 500, '4H': 500, '1D': 500, '1W': 200,
};

interface OHLCVBar { time: number; open: number; high: number; low: number; close: number; volume: number }
type Pt  = { time: number; value: number };
type VolPt = { time: number; value: number; color: string };

type CandleSeries = { setData: (d: OHLCVBar[]) => void; update: (b: OHLCVBar) => void };
type AreaHandle   = { setData: (d: Pt[]) => void; update: (b: Pt) => void };
type VolSeries    = { setData: (d: VolPt[]) => void; update: (b: VolPt) => void };
type BarHandle    = { setData: (d: OHLCVBar[]) => void; update: (b: OHLCVBar) => void };
type LineHandle   = { setData: (d: Pt[]) => void };

interface Indicators { volume: boolean; ma7: boolean; ma25: boolean; ema50: boolean }

function calcMA(bars: OHLCVBar[], n: number): Pt[] {
  return bars.slice(n - 1).map((_, i) => ({
    time: bars[i + n - 1]!.time,
    value: bars.slice(i, i + n).reduce((s, b) => s + b.close, 0) / n,
  }));
}

function calcEMA(bars: OHLCVBar[], n: number): Pt[] {
  if (bars.length < n) return [];
  const k = 2 / (n + 1);
  let ema = bars.slice(0, n).reduce((s, b) => s + b.close, 0) / n;
  const result: Pt[] = [{ time: bars[n - 1]!.time, value: ema }];
  for (let i = n; i < bars.length; i++) {
    ema = bars[i]!.close * k + ema * (1 - k);
    result.push({ time: bars[i]!.time, value: ema });
  }
  return result;
}

interface InnerProps { symbol: string; livePrice: number }
interface InnerState {
  tf: Timeframe;
  chartType: ChartType;
  liveBar: OHLCVBar | null;
  loading: boolean;
  error: boolean;
  moreOpen: boolean;
  indOpen: boolean;
  indicators: Indicators;
}

class TradingChartInner extends Component<InnerProps, InnerState> {
  override state: InnerState = {
    tf: '1H', chartType: 'candle', liveBar: null,
    loading: true, error: false,
    moreOpen: false, indOpen: false,
    indicators: { volume: true, ma7: false, ma25: false, ema50: false },
  };

  private containerRef  = createRef<HTMLDivElement>();
  private chart: ReturnType<typeof createChart> | null = null;
  private candleSeries: CandleSeries | null = null;
  private areaSeries:   AreaHandle   | null = null;
  private volSeries:    VolSeries    | null = null;
  private barSeries:    BarHandle    | null = null;
  private ma7Series:    LineHandle   | null = null;
  private ma25Series:   LineHandle   | null = null;
  private ema50Series:  LineHandle   | null = null;
  private resizeObs:    ResizeObserver | null = null;
  private rafId:        number | null = null;
  private bars:         OHLCVBar[] = [];

  override componentDidMount() {
    this.rafId = requestAnimationFrame(() => {
      this.initChart();
      void this.fetchCandles();
    });
  }

  override componentWillUnmount() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.resizeObs?.disconnect();
    this.chart?.remove();
  }

  override componentDidUpdate(pp: InnerProps, ps: InnerState) {
    const { symbol } = this.props;
    const { tf, chartType, indicators } = this.state;

    if (pp.symbol !== symbol || ps.tf !== tf) {
      this.setState({ loading: true, error: false, liveBar: null });
      void this.fetchCandles();
      return;
    }
    if (ps.chartType !== chartType) { this.applyType(this.bars); return; }
    if (ps.indicators !== indicators) { this.applyIndicators(this.bars); return; }

    const { livePrice } = this.props;
    if (pp.livePrice !== livePrice && livePrice > 0 && this.state.liveBar) {
      const bar = this.state.liveBar;
      const sec  = TF_INTERVAL[tf];
      const now  = Math.floor(Date.now() / 1000);
      const ct   = now - (now % sec);
      const updated: OHLCVBar = ct > bar.time
        ? { time: ct, open: bar.close, high: Math.max(bar.close, livePrice), low: Math.min(bar.close, livePrice), close: livePrice, volume: 0 }
        : { ...bar, high: Math.max(bar.high, livePrice), low: Math.min(bar.low, livePrice), close: livePrice };

      const isUp = updated.close >= updated.open;
      if (chartType === 'candle') {
        this.candleSeries?.update(updated);
        this.areaSeries?.update({ time: updated.time, value: updated.close });
      } else if (chartType === 'area') {
        this.areaSeries?.update({ time: updated.time, value: updated.close });
      } else {
        this.barSeries?.update(updated);
      }
      if (indicators.volume) {
        this.volSeries?.update({ time: updated.time, value: updated.volume, color: isUp ? 'rgba(16,185,129,0.30)' : 'rgba(239,68,68,0.30)' });
      }
      this.setState({ liveBar: updated });
    }
  }

  private initChart() {
    const el = this.containerRef.current;
    if (!el) return;

    this.chart = createChart(el, {
      width:  el.clientWidth  || 800,
      height: el.clientHeight || 420,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor:  '#374151',
        fontSize:   11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.018)' },
        horzLines: { color: 'rgba(255,255,255,0.018)' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: 'rgba(188,235,2,0.35)', width: 1, style: 3, labelBackgroundColor: '#0E0F00' },
        horzLine: { color: 'rgba(188,235,2,0.35)', width: 1, style: 3, labelBackgroundColor: '#BCEB02' },
      },
      timeScale: {
        borderColor:    'rgba(255,255,255,0.04)',
        timeVisible:    true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor:  'rgba(255,255,255,0.04)',
        scaleMargins: { top: 0.06, bottom: 0.22 },
        textColor:    '#374151',
      },
      handleScroll: true,
      handleScale:  true,
    });

    /* 1 — Area (behind candles) */
    this.areaSeries = this.chart.addSeries(AreaSeries, {
      lineColor:   'rgba(188,235,2,0.60)',
      topColor:    'rgba(188,235,2,0.10)',
      bottomColor: 'rgba(188,235,2,0.00)',
      lineWidth:   1,
      lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
      priceScaleId: 'right',
    }) as unknown as AreaHandle;

    /* 2 — Candlestick (on top) */
    this.candleSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: '#10B981', downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981', wickDownColor: '#EF4444',
    }) as unknown as CandleSeries;

    /* 3 — Bar series (alt chart type) */
    this.barSeries = this.chart.addSeries(BarSeries, {
      upColor: '#10B981', downColor: '#EF4444',
    }) as unknown as BarHandle;

    /* 4 — Volume histogram */
    this.volSeries = this.chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      lastValueVisible: false, priceLineVisible: false,
    }) as unknown as VolSeries;
    this.chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0.00 } });

    /* 5 — MA / EMA line series */
    this.ma7Series = this.chart.addSeries(LineSeries, {
      color: '#F59E0B', lineWidth: 1,
      lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
    }) as unknown as LineHandle;

    this.ma25Series = this.chart.addSeries(LineSeries, {
      color: '#8B5CF6', lineWidth: 1,
      lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
    }) as unknown as LineHandle;

    this.ema50Series = this.chart.addSeries(LineSeries, {
      color: '#06B6D4', lineWidth: 1,
      lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
    }) as unknown as LineHandle;

    this.resizeObs = new ResizeObserver(() => {
      if (el && this.chart) this.chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    this.resizeObs.observe(el);
  }

  private applyType(bars: OHLCVBar[]) {
    if (!bars.length) return;
    const { chartType } = this.state;

    if (chartType === 'candle') {
      this.candleSeries?.setData(bars);
      this.areaSeries?.setData(bars.map((b) => ({ time: b.time, value: b.close })));
      this.barSeries?.setData([]);
    } else if (chartType === 'area') {
      this.candleSeries?.setData([]);
      this.barSeries?.setData([]);
      this.areaSeries?.setData(bars.map((b) => ({ time: b.time, value: b.close })));
    } else {
      this.candleSeries?.setData([]);
      this.areaSeries?.setData([]);
      this.barSeries?.setData(bars);
    }
    this.applyIndicators(bars);
  }

  private applyIndicators(bars: OHLCVBar[]) {
    const { indicators } = this.state;
    this.volSeries?.setData(indicators.volume ? bars.map((b) => ({
      time: b.time, value: b.volume,
      color: b.close >= b.open ? 'rgba(16,185,129,0.30)' : 'rgba(239,68,68,0.30)',
    })) : []);
    this.ma7Series?.setData(indicators.ma7 && bars.length >= 7 ? calcMA(bars, 7) : []);
    this.ma25Series?.setData(indicators.ma25 && bars.length >= 25 ? calcMA(bars, 25) : []);
    this.ema50Series?.setData(indicators.ema50 && bars.length >= 50 ? calcEMA(bars, 50) : []);
  }

  private async fetchCandles() {
    const { symbol } = this.props;
    const { tf } = this.state;
    const binSym = BINANCE_SYMBOL[symbol];
    try {
      let bars: OHLCVBar[];
      if (binSym) {
        const res = await fetch(`${BINANCE_URL}?symbol=${binSym}&interval=${BINANCE_INTERVAL[tf]}&limit=${TF_LIMIT[tf]}`);
        if (!res.ok) throw new Error(`Binance ${res.status}`);
        const raw = (await res.json()) as [number, string, string, string, string, string][];
        bars = raw.map((k) => ({
          time:   Math.floor(k[0] / 1000),
          open:   parseFloat(k[1]),
          high:   parseFloat(k[2]),
          low:    parseFloat(k[3]),
          close:  parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }));
      } else {
        const res = await fetch(`${API_URL}/markets/${symbol}/candles?timeframe=${tf}`);
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = (await res.json()) as { candles: { time: number; open: number; high: number; low: number; close: number }[] };
        bars = data.candles.map((c) => ({ ...c, volume: 0 }));
      }
      if (!bars.length) { this.setState({ loading: false, error: false }); return; }
      this.bars = bars;
      this.applyType(bars);
      this.chart?.timeScale().fitContent();
      this.chart?.timeScale().scrollToRealtime();
      this.setState({ liveBar: bars.at(-1)!, loading: false, error: false });
    } catch {
      try {
        const res = await fetch(`${API_URL}/markets/${symbol}/candles?timeframe=${tf}`);
        if (!res.ok) throw new Error('fallback');
        const data = (await res.json()) as { candles: { time: number; open: number; high: number; low: number; close: number }[] };
        const bars = data.candles.map((c) => ({ ...c, volume: 0 }));
        this.bars = bars;
        this.applyType(bars);
        this.chart?.timeScale().fitContent();
        this.chart?.timeScale().scrollToRealtime();
        this.setState({ liveBar: bars.at(-1)!, loading: false, error: false });
      } catch {
        this.setState({ loading: false, error: true });
      }
    }
  }

  private handleDownload() {
    if (!this.chart) return;
    try {
      const canvas = this.chart.takeScreenshot();
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `kaido-${this.props.symbol}-${this.state.tf}.png`;
      a.click();
    } catch { /* ignore */ }
  }

  private toggleInd(k: keyof Indicators) {
    this.setState((s) => ({ indicators: { ...s.indicators, [k]: !s.indicators[k] } }));
  }

  override render() {
    const { tf, chartType, liveBar, loading, error, moreOpen, indOpen, indicators } = this.state;
    const { livePrice } = this.props;
    const bar = liveBar && livePrice > 0
      ? { ...liveBar, close: livePrice, high: Math.max(liveBar.high, livePrice), low: Math.min(liveBar.low, livePrice) }
      : liveBar;
    const isUp = bar ? bar.close >= bar.open : true;
    const activeIndCount = Object.values(indicators).filter(Boolean).length;

    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* ── Toolbar ────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 px-2 h-9 border-b border-white/[0.04] bg-[#0E0F00]/70 shrink-0">

          {/* Timeframes */}
          <div className="flex items-center gap-px shrink-0">
            {VISIBLE_TFS.map((t) => (
              <button
                key={t}
                onClick={() => this.setState({ tf: t, moreOpen: false })}
                className={cn(
                  'px-2 py-0.5 text-[10.5px] font-bold rounded transition-colors',
                  tf === t ? 'bg-primary/20 text-primary' : 'text-gray-600 hover:text-gray-300',
                )}
              >{t}</button>
            ))}
            {/* More dropdown */}
            <div className="relative">
              <button
                onClick={() => this.setState((s) => ({ moreOpen: !s.moreOpen, indOpen: false }))}
                className={cn(
                  'flex items-center gap-0.5 px-1.5 py-0.5 text-[10.5px] font-bold rounded transition-colors',
                  MORE_TFS.includes(tf) ? 'bg-primary/20 text-primary' : 'text-gray-600 hover:text-gray-300',
                )}
              >
                {MORE_TFS.includes(tf) ? tf : 'More'}
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-[190]" onClick={() => this.setState({ moreOpen: false })} />
                  <div className="absolute top-full left-0 mt-1 bg-[#0c0210] border border-white/[0.08] rounded-xl p-1 z-[200] shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex flex-col min-w-[64px]">
                    {MORE_TFS.map((t) => (
                      <button
                        key={t}
                        onClick={() => this.setState({ tf: t, moreOpen: false })}
                        className={cn(
                          'px-3 py-1.5 text-[11px] font-bold rounded-lg text-left transition-colors',
                          tf === t ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-white hover:bg-white/[0.06]',
                        )}
                      >{t}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="w-px h-3.5 bg-white/[0.06] shrink-0" />

          {/* Chart type */}
          <div className="flex items-center gap-px shrink-0">
            {([
              { t: 'candle', Icon: CandlestickChart, label: 'Candles' },
              { t: 'area',   Icon: AreaChart,         label: 'Area'    },
              { t: 'bar',    Icon: BarChart2,          label: 'Bars'    },
            ] as { t: ChartType; Icon: React.ComponentType<{ className?: string }>; label: string }[]).map(({ t, Icon, label }) => (
              <button
                key={t}
                title={label}
                onClick={() => this.setState({ chartType: t })}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  chartType === t ? 'text-primary bg-primary/15' : 'text-gray-600 hover:text-gray-300',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>

          <div className="w-px h-3.5 bg-white/[0.06] shrink-0" />

          {/* Indicators */}
          <div className="relative shrink-0">
            <button
              onClick={() => this.setState((s) => ({ indOpen: !s.indOpen, moreOpen: false }))}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-bold rounded transition-colors',
                indOpen || activeIndCount > 0 ? 'bg-primary/20 text-primary' : 'text-gray-600 hover:text-gray-300',
              )}
            >
              Indicators
              {activeIndCount > 0 && (
                <span className="w-3.5 h-3.5 rounded-full bg-primary text-white text-[8px] font-black flex items-center justify-center">
                  {activeIndCount}
                </span>
              )}
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            {indOpen && (
              <>
                <div className="fixed inset-0 z-[190]" onClick={() => this.setState({ indOpen: false })} />
                <div className="absolute top-full left-0 mt-1 bg-[#0c0210] border border-white/[0.08] rounded-xl p-2 z-[200] shadow-[0_12px_40px_rgba(0,0,0,0.85)] min-w-[178px] space-y-px">
                  <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest px-2 py-1">Overlays</p>
                  {([
                    { k: 'ma7',   label: 'MA (7)',   color: '#F59E0B' },
                    { k: 'ma25',  label: 'MA (25)',  color: '#8B5CF6' },
                    { k: 'ema50', label: 'EMA (50)', color: '#06B6D4' },
                  ] as { k: keyof Indicators; label: string; color: string }[]).map(({ k, label, color }) => (
                    <button
                      key={k}
                      onClick={() => this.toggleInd(k)}
                      className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-[11px] text-gray-300 flex-1 text-left">{label}</span>
                      <span className={cn(
                        'w-3.5 h-3.5 rounded border flex items-center justify-center transition-all',
                        indicators[k] ? 'bg-primary border-primary' : 'border-white/[0.15]',
                      )}>
                        {indicators[k] && <span className="w-1.5 h-1 bg-white rounded-sm" />}
                      </span>
                    </button>
                  ))}
                  <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest px-2 py-1 pt-2">Panels</p>
                  <button
                    onClick={() => this.toggleInd('volume')}
                    className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0 bg-gray-500" />
                    <span className="text-[11px] text-gray-300 flex-1 text-left">Volume</span>
                    <span className={cn(
                      'w-3.5 h-3.5 rounded border flex items-center justify-center transition-all',
                      indicators.volume ? 'bg-primary border-primary' : 'border-white/[0.15]',
                    )}>
                      {indicators.volume && <span className="w-1.5 h-1 bg-white rounded-sm" />}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Download */}
          <button
            onClick={() => this.handleDownload()}
            title="Download chart as PNG"
            className="p-1.5 text-gray-600 hover:text-gray-300 rounded transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* OHLCV row */}
          {bar && (
            <div className="hidden sm:flex items-center gap-2 text-[10.5px] font-mono shrink-0 pl-1">
              <div className="w-px h-3.5 bg-white/[0.06]" />
              <span className="text-gray-600">O <span className="text-gray-400">{bar.open.toFixed(2)}</span></span>
              <span className="text-gray-600">H <span className="text-success">{bar.high.toFixed(2)}</span></span>
              <span className="text-gray-600">L <span className="text-error">{bar.low.toFixed(2)}</span></span>
              <span className="text-gray-600">C <span className={isUp ? 'text-success' : 'text-error'}>{bar.close.toFixed(2)}</span></span>
              {(bar as OHLCVBar).volume > 0 && (
                <span className="text-gray-600">V <span className="text-gray-500">{((bar as OHLCVBar).volume / 1000).toFixed(0)}K</span></span>
              )}
            </div>
          )}

          {/* Live price — right-aligned */}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {!loading && livePrice > 0 && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] font-mono text-success">${livePrice.toFixed(2)}</span>
              </>
            )}
            {loading  && <span className="text-[10px] text-gray-700 font-mono animate-pulse">loading…</span>}
            {!loading && error && <span className="text-[10px] text-error/60 font-mono">offline</span>}
          </div>
        </div>

        {/* ── Chart canvas ────────────────────────────────── */}
        <div className="relative flex-1 min-h-0">
          <div ref={this.containerRef} className="absolute inset-0" />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0B0C00]/60 z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-7 h-7 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                <span className="text-[11px] font-mono text-gray-600">Loading market data…</span>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center space-y-2">
                <p className="text-[12px] text-gray-600 font-mono">Could not fetch chart data</p>
                <button
                  onClick={() => { this.setState({ loading: true, error: false }); void this.fetchCandles(); }}
                  className="text-[11px] text-primary hover:text-primary/80 font-semibold transition-colors"
                >Retry</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export function TradingChart() {
  const activeMarket = useKaidoStore((s) => s.activeMarket);
  const livePrice    = useKaidoStore((s) => s.tickers[activeMarket]?.price ?? 0);
  return <TradingChartInner symbol={activeMarket} livePrice={livePrice} />;
}
