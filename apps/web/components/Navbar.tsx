'use client';

import { Component, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useKaidoStore } from '../store';
import { MarketSelector, LiveStats, WsStatusDot } from './MarketHeader';

interface NavItem { label: string; href: string; hot?: boolean }

const NAV_ITEMS: NavItem[] = [
  { label: 'Markets',   href: '/markets'   },
  { label: 'Perps',     href: '/perps' },
  { label: 'Predict',   href: '/events'    },
];

const MORE_ITEMS = [
  { label: 'Insights',   href: '/insights'   },
  { label: 'AI Copilot', href: '/ai-copilot' },
  { label: 'Watchlist',  href: '/watchlist'  },
  { label: 'Stake',      href: '/stake'      },
];

function NavLinks() {
  const pathname  = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="hidden md:flex items-center gap-0.5 relative">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              'relative px-4 py-1.5 text-[13px] font-bold transition-all duration-150',
              active ? 'text-primary' : 'text-gray-500 hover:text-primary hover:bg-primary/5 rounded-full',
            )}
          >
            {item.label}
            {item.hot && (
              <span className="absolute top-1.5 right-2 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
              </span>
            )}
          </Link>
        );
      })}

      {/* More dropdown */}
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex items-center gap-1 px-4 py-1.5 text-[13px] font-bold transition-all rounded-full',
            open ? 'text-primary bg-primary/10' : 'text-gray-500 hover:text-primary hover:bg-primary/5',
          )}
        >
          More
          <ChevronDown className={cn('w-3 h-3 transition-transform duration-200', open && 'rotate-180')} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-[190]" onClick={() => setOpen(false)} />
            <div className="absolute top-full left-0 mt-2 w-44 bg-[#0c0210] border border-white/[0.07] rounded-2xl p-1.5 z-[200] shadow-[0_16px_48px_rgba(0,0,0,0.80)]">
              {MORE_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 text-[13px] font-bold text-gray-500 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </nav>
  );
}

interface NavbarInnerProps {
  wallet: { connected: boolean; publicKey: string | null };
  onOpenWallet: () => void;
  pathname: string;
}

class NavbarInner extends Component<NavbarInnerProps> {
  override render() {
    const { wallet, onOpenWallet, pathname } = this.props;
    return (
      <header className="h-14 border-b border-white/[0.04] bg-[#0E0F00]/90 backdrop-blur-2xl flex items-center justify-between px-6 z-[100] sticky top-0 shrink-0">
        {/* Left — logo + nav links */}
        <div className="flex items-center gap-8 h-full">
          <Link href="/" className="flex items-center cursor-pointer group shrink-0 h-full">
            <svg viewBox="0 0 100 100" className="w-8 h-8 fill-primary drop-shadow-[0_0_10px_rgba(188,235,2,0.60)] transition-transform duration-300 group-hover:scale-110">
              <path d="M40,2 Q69,36 69,73 L40,73 Z" />
              <path d="M3,98 L97,73 L85,98 Z" />
            </svg>
          </Link>
          
          <div className="flex items-center h-full">
            <NavLinks />
          </div>
        </div>

        {/* Right — Portfolio + Pulse + Wallet */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-5">
            <WsStatusDot />
            <Link
              href="/portfolio"
              className={cn(
                'h-8 px-4 flex items-center justify-center text-[12px] font-black tracking-tight transition-all active:scale-95 rounded-sm',
                pathname.startsWith('/portfolio') 
                  ? 'bg-primary text-black' 
                  : 'bg-primary/10 text-primary hover:bg-primary hover:text-black border border-primary/20'
              )}
            >
              PORTFOLIO
            </Link>
          </div>
          
          <button
            onClick={onOpenWallet}
            className="relative h-9 px-6 bg-primary text-black rounded-full text-[13px] font-black flex items-center gap-2 hover:scale-105 active:scale-95 transition-all group shrink-0"
          >
            {/* Sketchy offset outline */}
            <div className="absolute -inset-[3px] border border-primary/50 rounded-[55%_45%_52%_48%/48%_52%_50%_50%] -rotate-2 pointer-events-none group-hover:rotate-1 transition-transform duration-500" />
            
            <Wallet className="w-4 h-4" />
            <span className="relative z-10">
              {wallet.connected && wallet.publicKey
                ? `${wallet.publicKey.slice(0, 4)}…${wallet.publicKey.slice(-4)}`
                : 'Connect Wallet'}
            </span>
          </button>
        </div>
      </header>
    );
  }
}

export function Navbar() {
  const wallet             = useKaidoStore((s) => s.wallet);
  const setWalletModalOpen = useKaidoStore((s) => s.setWalletModalOpen);
  const pathname           = usePathname();
  return <NavbarInner wallet={wallet} onOpenWallet={() => setWalletModalOpen(true)} pathname={pathname} />;
}
