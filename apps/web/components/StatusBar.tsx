'use client';

import { Component } from 'react';

interface StatusBarState {
  latency: number;
  connected: boolean;
}

export class StatusBar extends Component<Record<string, never>, StatusBarState> {
  override state: StatusBarState = { latency: 42, connected: true };
  private interval: ReturnType<typeof setInterval> | null = null;

  override componentDidMount() {
    this.interval = setInterval(() => {
      this.setState({ latency: 30 + Math.floor(Math.random() * 40) });
    }, 3000);
  }

  override componentWillUnmount() {
    if (this.interval) clearInterval(this.interval);
  }

  override render() {
    const { latency, connected } = this.state;
    return (
      <footer className="h-7 border-t border-white/5 bg-black/80 flex items-center justify-between px-4 text-[10px] text-gray-500 font-mono shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success' : 'bg-error'}`} />
            <span>{connected ? 'MAINNET-BETA' : 'DISCONNECTED'}</span>
          </div>
          <span>LATENCY: {latency}ms</span>
        </div>
        <div className="flex items-center gap-4">
          <span>RPC: HELIUS</span>
          <span>v0.1.0</span>
        </div>
      </footer>
    );
  }
}
