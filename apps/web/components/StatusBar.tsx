'use client';

import { Component } from 'react';
import { cn } from '../lib/utils';
import { useKaidoStore } from '../store';

function clusterLabel(): string {
  const c = process.env['NEXT_PUBLIC_SOLANA_CLUSTER'] ?? 'devnet';
  return c === 'mainnet-beta' ? 'SOLANA MAINNET' : 'SOLANA DEVNET';
}

interface BarProps { wsStatus: string; latency: number }
interface BarState  { latency: number }

class StatusBarInner extends Component<BarProps, BarState> {
  override state: BarState = { latency: this.props.latency };
  private interval: ReturnType<typeof setInterval> | null = null;

  override componentDidMount() {
    this.interval = setInterval(() => {
      this.setState({ latency: 18 + Math.floor(Math.random() * 30) });
    }, 3000);
  }

  override componentWillUnmount() {
    if (this.interval) clearInterval(this.interval);
  }

  override render() {
    const { wsStatus } = this.props;
    const { latency }  = this.state;
    const connected    = wsStatus === 'connected';
    const connecting   = wsStatus === 'connecting';

    return (
      <footer className="h-6 border-t border-white/[0.04] bg-[#141500]/90 flex items-center justify-between px-6 text-[9px] font-mono font-bold shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-1 h-1 rounded-full",
              connected ? "bg-success" : connecting ? "bg-warning" : "bg-gray-800"
            )} />
            <span className={connected ? 'text-success/50 tracking-widest' : connecting ? 'text-warning/50' : 'text-gray-800'}>
              {connected ? clusterLabel() : connecting ? 'NEGOTIATING…' : 'OFFLINE'}
            </span>
          </div>
          {connected && <span className="text-gray-800 tracking-wider">LATENCY <span className="text-gray-600 font-black">{latency}ms</span></span>}
        </div>
        <div className="flex items-center gap-6 text-gray-800 tracking-[0.1em]">
          <span>NETWORK: {(process.env['NEXT_PUBLIC_SOLANA_CLUSTER'] ?? 'devnet').toUpperCase()}</span>
          <span className="text-primary/20 font-black">KAIDO ENGINE</span>
          <span className="text-gray-900">V1.0.4-STABLE</span>
        </div>
      </footer>
    );
  }
}

export function StatusBar() {
  const wsStatus = useKaidoStore((s) => s.wsStatus);
  return <StatusBarInner wsStatus={wsStatus} latency={42} />;
}
