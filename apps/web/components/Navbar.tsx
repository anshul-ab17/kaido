'use client';

import { Component, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useKaidoStore } from '../store';

interface NavItem { label: string; href: string; hot?: boolean }

const NAV_ITEMS: NavItem[] = [
  { label: 'Markets',   href: '/markets'   },
  { label: 'Perps',     href: '/perps' },
  { label: 'Predict',   href: '/events'    },
  { label: 'Portfolio', href: '/portfolio' },
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
              'relative px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors duration-150',
              active ? 'text-primary bg-primary/10' : 'text-gray-500 hover:text-white hover:bg-white/[0.04]',
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
            'flex items-center gap-1 px-4 py-1.5 text-[13px] font-bold transition-colors rounded-full',
            open ? 'text-white bg-white/[0.06]' : 'text-gray-500 hover:text-white hover:bg-white/[0.04]',
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
                  className="block px-3 py-2 text-[13px] font-bold text-gray-500 hover:text-white hover:bg-white/[0.05] rounded-xl transition-colors"
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
}

class NavbarInner extends Component<NavbarInnerProps> {
  override render() {
    const { wallet, onOpenWallet } = this.props;
    return (
      <header className="h-14 border-b border-white/[0.04] bg-[#0E0F00]/90 backdrop-blur-2xl flex items-center justify-between px-6 z-[100] sticky top-0 shrink-0">
        {/* Left — logo + nav */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center cursor-pointer group shrink-0">
            <div className="w-9 h-9 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <svg viewBox="0 0 100 100" className="w-8 h-8 fill-primary drop-shadow-[0_0_10px_rgba(188,235,2,0.60)]">
                <path d="M42,15 Q65,42 65,72 L42,72 Z" />
                <path d="M12,92 L88,72 L78,92 Z" />
              </svg>
            </div>
          </Link>
          <NavLinks />
        </div>

        {/* Right — wallet only */}
        <button
          onClick={onOpenWallet}
          className="h-9 px-5 bg-primary text-black rounded-full text-[13px] font-bold flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-[0_0_18px_rgba(188,235,2,0.35)]"
        >
          <Wallet className="w-4 h-4" />
          {wallet.connected && wallet.publicKey
            ? `${wallet.publicKey.slice(0, 4)}…${wallet.publicKey.slice(-4)}`
            : 'Connect Wallet'}
        </button>
      </header>
    );
  }
}

export function Navbar() {
  const wallet             = useKaidoStore((s) => s.wallet);
  const setWalletModalOpen = useKaidoStore((s) => s.setWalletModalOpen);
  return <NavbarInner wallet={wallet} onOpenWallet={() => setWalletModalOpen(true)} />;
}
