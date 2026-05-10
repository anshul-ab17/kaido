'use client';

import { Component } from 'react';
import { Navbar } from '../../components/Navbar';
import { Zap, Lock, TrendingUp, Info, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useKaidoStore } from '../../store';

interface StakePool {
  id: string;
  name: string;
  token: string;
  apy: number;
  tvl: number;
  lockupDays: number;
  myStake: number;
  rewards: number;
  description: string;
}

const POOLS: StakePool[] = [
  {
    id: 'kai-flexible',
    name: 'KAI Flexible',
    token: 'KAI',
    apy: 12.4,
    tvl: 4_200_000,
    lockupDays: 0,
    myStake: 0,
    rewards: 0,
    description: 'Stake KAI tokens with no lock-up. Earn protocol fees and governance rights.',
  },
  {
    id: 'kai-30d',
    name: 'KAI 30-Day',
    token: 'KAI',
    apy: 24.8,
    tvl: 8_700_000,
    lockupDays: 30,
    myStake: 0,
    rewards: 0,
    description: '30-day lock-up for 2x multiplier on base APY. Early withdrawal incurs 3% penalty.',
  },
  {
    id: 'kai-90d',
    name: 'KAI 90-Day',
    token: 'KAI',
    apy: 48.0,
    tvl: 12_100_000,
    lockupDays: 90,
    myStake: 0,
    rewards: 0,
    description: '90-day lock-up for maximum yield. VIP trading fee discounts and priority liquidations.',
  },
  {
    id: 'sol-lp',
    name: 'SOL-USDC LP',
    token: 'SOL/USDC',
    apy: 32.1,
    tvl: 28_500_000,
    lockupDays: 7,
    myStake: 0,
    rewards: 0,
    description: 'Provide liquidity to the SOL/USDC perp pool. Earn trading fees + KAI incentives.',
  },
];

interface StakeState {
  selectedPool: string | null;
  amount: string;
  tab: 'stake' | 'unstake';
}

interface StakePageProps {
  walletConnected: boolean;
  onOpenWallet: () => void;
}

function fmt(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(2)}`;
}

class StakePage extends Component<StakePageProps, StakeState> {
  override state: StakeState = {
    selectedPool: null,
    amount: '',
    tab: 'stake',
  };

  private handleAction = () => {
    const { walletConnected, onOpenWallet } = this.props;
    if (!walletConnected) { onOpenWallet(); return; }
    // Would submit stake transaction here
    this.setState({ amount: '' });
  };

  override render() {
    const { walletConnected } = this.props;
    const { selectedPool, amount, tab } = this.state;
    const pool = POOLS.find((p) => p.id === selectedPool) ?? null;

    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold font-heading">Stake & Earn</h1>
            <p className="text-sm text-gray-500 mt-1">Lock KAI tokens or provide liquidity to earn yield and protocol fees</p>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Staked', value: fmt(POOLS.reduce((a, p) => a + p.tvl, 0)) },
              { label: 'Avg APY', value: `${(POOLS.reduce((a, p) => a + p.apy, 0) / POOLS.length).toFixed(1)}%` },
              { label: 'Active Stakers', value: '2,841' },
            ].map((s) => (
              <div key={s.label} className="glass-card rounded-xl p-4 text-center">
                <p className="text-[10px] font-mono text-gray-500 uppercase">{s.label}</p>
                <p className="text-xl font-bold text-white mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Pool list */}
            <div className="lg:col-span-2 space-y-2">
              {POOLS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => this.setState({ selectedPool: p.id === selectedPool ? null : p.id })}
                  className={cn(
                    'w-full text-left rounded-xl border p-4 transition-all',
                    selectedPool === p.id
                      ? 'border-primary/[0.30] bg-primary/[0.06]'
                      : 'border-white/[0.06] hover:border-primary/[0.15] hover:bg-white/[0.02]'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                        <Zap className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{p.name}</p>
                        <p className="text-[11px] text-gray-500">{p.token}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <p className="text-base font-bold text-success">{p.apy.toFixed(1)}%</p>
                        <p className="text-[10px] text-gray-600">APY</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono text-white">{fmt(p.tvl)}</p>
                        <p className="text-[10px] text-gray-600">TVL</p>
                      </div>
                      <div className="text-right">
                        {p.lockupDays === 0
                          ? <span className="text-xs text-accent font-medium">Flexible</span>
                          : (
                            <div className="flex items-center gap-1 text-warning">
                              <Lock className="w-3 h-3" />
                              <span className="text-xs font-medium">{p.lockupDays}d</span>
                            </div>
                          )
                        }
                        <p className="text-[10px] text-gray-600">Lock-up</p>
                      </div>
                      <ChevronDown className={cn('w-4 h-4 text-gray-600 transition-transform', selectedPool === p.id && 'rotate-180')} />
                    </div>
                  </div>
                  {selectedPool === p.id && (
                    <div className="mt-3 pt-3 border-t border-white/[0.06]">
                      <p className="text-xs text-gray-500">{p.description}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Stake panel */}
            <div className="glass-card rounded-xl p-5 space-y-4 self-start">
              <p className="text-sm font-bold text-white">
                {pool ? pool.name : 'Select a Pool'}
              </p>

              {pool ? (
                <>
                  {/* Tab */}
                  <div className="flex bg-black/40 rounded-lg p-1 gap-1">
                    {(['stake', 'unstake'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => this.setState({ tab: t })}
                        className={cn(
                          'flex-1 py-1.5 rounded-md text-xs font-medium transition-all capitalize',
                          tab === t ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-300'
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Amount input */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-mono">Amount ({pool.token})</label>
                    <div className="relative">
                      <input
                        value={amount}
                        onChange={(e) => this.setState({ amount: e.target.value })}
                        placeholder="0.00"
                        type="number"
                        className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/[0.25] pr-14 transition-colors"
                      />
                      <button
                        onClick={() => this.setState({ amount: '1000' })}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-primary font-bold hover:brightness-125 transition-all"
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  {/* APY info */}
                  <div className="bg-black/30 rounded-lg p-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">APY</span>
                      <span className="text-success font-bold">{pool.apy.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Lock-up</span>
                      <span className="text-white">{pool.lockupDays === 0 ? 'None' : `${pool.lockupDays} days`}</span>
                    </div>
                    {amount && Number(amount) > 0 && (
                      <div className="flex justify-between text-xs border-t border-white/[0.06] pt-1.5 mt-1.5">
                        <span className="text-gray-500">Est. monthly</span>
                        <span className="text-success">+{((Number(amount) * pool.apy) / 100 / 12).toFixed(2)} {pool.token}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={this.handleAction}
                    className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:brightness-110 active:scale-95 transition-all"
                  >
                    {walletConnected ? (tab === 'stake' ? 'Stake Now' : 'Unstake') : 'Connect Wallet'}
                  </button>

                  <div className="flex items-start gap-2 text-[10px] text-gray-700">
                    <Info className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>Staking rewards are distributed daily. Unstaking may take up to 1 epoch to settle.</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <TrendingUp className="w-8 h-8 text-gray-700" />
                  <p className="text-xs text-gray-600 text-center">Select a staking pool to see deposit options</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default function StakePageWrapper() {
  const wallet = useKaidoStore((s) => s.wallet);
  const setWalletModalOpen = useKaidoStore((s) => s.setWalletModalOpen);
  return (
    <StakePage
      walletConnected={wallet.connected}
      onOpenWallet={() => setWalletModalOpen(true)}
    />
  );
}
