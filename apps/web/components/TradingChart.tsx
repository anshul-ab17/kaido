'use client';

import { Component, createRef } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';
import { cn } from '../lib/utils';

type Timeframe = '1H' | '4H' | '1D' | '1W';

interface TradingChartState {
  activeTimeframe: Timeframe;
}

export class TradingChart extends Component<Record<string, never>, TradingChartState> {
  override state: TradingChartState = { activeTimeframe: '4H' };
  private containerRef = createRef<HTMLDivElement>();
  private chart: ReturnType<typeof createChart> | null = null;
  private resizeObserver: ResizeObserver | null = null;

  override componentDidMount() {
    this.initChart();
  }

  override componentWillUnmount() {
    this.resizeObserver?.disconnect();
    this.chart?.remove();
  }

  private initChart() {
    if (!this.containerRef.current) return;
    this.chart = createChart(this.containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748B',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        vertLine: { labelBackgroundColor: '#E11D48' },
        horzLine: { labelBackgroundColor: '#E11D48' },
      },
      width: this.containerRef.current.clientWidth,
      height: 380,
      timeScale: { borderColor: 'rgba(255,255,255,0.05)' },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.05)' },
    });

    const series = this.chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#E11D48',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#E11D48',
    });

    series.setData([
      { time: '2024-01-01', open: 102.20, high: 108.50, low: 101.10, close: 106.90 },
      { time: '2024-01-02', open: 106.90, high: 115.20, low: 106.50, close: 112.30 },
      { time: '2024-01-03', open: 112.30, high: 120.00, low: 111.00, close: 118.50 },
      { time: '2024-01-04', open: 118.50, high: 119.20, low: 113.50, close: 115.10 },
      { time: '2024-01-05', open: 115.10, high: 128.00, low: 114.80, close: 125.80 },
      { time: '2024-01-06', open: 125.80, high: 138.50, low: 124.20, close: 135.20 },
      { time: '2024-01-07', open: 135.20, high: 148.10, low: 133.20, close: 145.20 },
    ]);

    this.resizeObserver = new ResizeObserver(() => {
      if (this.containerRef.current && this.chart) {
        this.chart.applyOptions({ width: this.containerRef.current.clientWidth });
      }
    });
    this.resizeObserver.observe(this.containerRef.current);
  }

  private setTimeframe = (tf: Timeframe) => this.setState({ activeTimeframe: tf });

  override render() {
    const { activeTimeframe } = this.state;
    const timeframes: Timeframe[] = ['1H', '4H', '1D', '1W'];
    return (
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-4">
            <h3 className="text-base font-bold font-heading">SOL/USDC</h3>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="text-gray-500">O: <span className="text-gray-300">145.20</span></span>
              <span className="text-gray-500">H: <span className="text-success">148.10</span></span>
              <span className="text-gray-500">L: <span className="text-error">133.20</span></span>
              <span className="text-gray-500">C: <span className="text-gray-300">145.20</span></span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => this.setTimeframe(tf)}
                className={cn(
                  'px-2.5 py-1 text-[10px] font-bold rounded transition-all',
                  activeTimeframe === tf
                    ? 'bg-primary/20 border border-primary/40 text-primary'
                    : 'glass hover:bg-white/10 text-gray-400'
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        <div ref={this.containerRef} />
      </div>
    );
  }
}
