'use client';

/**
 * Shared coin icon component — inline SVG brand logos for all major assets.
 * Usage: <CoinIcon symbol="SOL" size={24} />
 *        <CoinIcon symbol="BTC-PERP" size={20} />  (strips -PERP suffix automatically)
 */

interface CoinIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

interface CoinMeta {
  bg: string;
  fg: string;
  path: React.ReactNode;
}

// Inline SVG paths — simplified brand-representative shapes at 24×24 viewBox
const COIN_META: Record<string, CoinMeta> = {
  SOL: {
    bg: 'linear-gradient(135deg,#9945FF,#7B3FE4)',
    fg: '#fff',
    path: (
      <>
        {/* Solana three-bar logo */}
        <rect x="4" y="6" width="16" height="2.5" rx="1.25" fill="white" />
        <rect x="6" y="10.75" width="12" height="2.5" rx="1.25" fill="white" />
        <rect x="4" y="15.5" width="16" height="2.5" rx="1.25" fill="white" />
      </>
    ),
  },
  BTC: {
    bg: 'linear-gradient(135deg,#F7931A,#E07B10)',
    fg: '#fff',
    path: (
      <>
        {/* Bitcoin B */}
        <text x="12" y="17" textAnchor="middle" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="13" fill="white">₿</text>
      </>
    ),
  },
  ETH: {
    bg: 'linear-gradient(135deg,#627EEA,#3C5DDD)',
    fg: '#fff',
    path: (
      <>
        {/* Ethereum diamond */}
        <polygon points="12,3 19,12 12,15 5,12" fill="white" opacity="0.9" />
        <polygon points="12,16 19,12 12,21 5,12" fill="white" opacity="0.6" />
      </>
    ),
  },
  USDC: {
    bg: 'linear-gradient(135deg,#2775CA,#1A5FAA)',
    fg: '#fff',
    path: (
      <>
        <circle cx="12" cy="12" r="7" fill="none" stroke="white" strokeWidth="2" />
        <text x="12" y="16" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="9" fill="white">$</text>
      </>
    ),
  },
  USDT: {
    bg: 'linear-gradient(135deg,#26A17B,#1D8A6A)',
    fg: '#fff',
    path: (
      <>
        <text x="12" y="16" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="9" fill="white">₮</text>
        <rect x="6" y="7" width="12" height="2" rx="1" fill="white" />
      </>
    ),
  },
  BNB: {
    bg: 'linear-gradient(135deg,#F0B90B,#D4A300)',
    fg: '#000',
    path: (
      <>
        {/* BNB diamond */}
        <polygon points="12,4 16,8 12,12 8,8" fill="#1B1B1B" />
        <polygon points="12,12 16,16 12,20 8,16" fill="#1B1B1B" />
        <polygon points="4,12 8,8 12,12 8,16" fill="#1B1B1B" />
        <polygon points="16,8 20,12 16,16 12,12" fill="#1B1B1B" />
      </>
    ),
  },
  ARB: {
    bg: 'linear-gradient(135deg,#12AAFF,#0088DD)',
    fg: '#fff',
    path: (
      <>
        {/* Arbitrum A-like shape */}
        <polygon points="12,3 20,20 4,20" fill="none" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
        <line x1="7" y1="15" x2="17" y2="15" stroke="white" strokeWidth="2" />
      </>
    ),
  },
  JUP: {
    bg: 'linear-gradient(135deg,#C7F284,#8BC34A)',
    fg: '#1a2e00',
    path: (
      <>
        {/* Jupiter J */}
        <text x="12" y="17" textAnchor="middle" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="14" fill="#1a2e00">J</text>
      </>
    ),
  },
  BONK: {
    bg: 'linear-gradient(135deg,#FF6B00,#E05500)',
    fg: '#fff',
    path: (
      <>
        <text x="12" y="17" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="9" fill="white">BONK</text>
      </>
    ),
  },
  WIF: {
    bg: 'linear-gradient(135deg,#7B5EA7,#5D4080)',
    fg: '#fff',
    path: (
      <>
        <text x="12" y="17" textAnchor="middle" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="11" fill="white">W</text>
      </>
    ),
  },
  RAY: {
    bg: 'linear-gradient(135deg,#4DA6E8,#2E86C1)',
    fg: '#fff',
    path: (
      <>
        <text x="12" y="17" textAnchor="middle" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="13" fill="white">R</text>
      </>
    ),
  },
  OP: {
    bg: 'linear-gradient(135deg,#FF0420,#CC0319)',
    fg: '#fff',
    path: (
      <>
        <circle cx="12" cy="12" r="6" fill="none" stroke="white" strokeWidth="2.5" />
        <circle cx="12" cy="12" r="2" fill="white" />
      </>
    ),
  },
  PYTH: {
    bg: 'linear-gradient(135deg,#6B4EFF,#4C35CC)',
    fg: '#fff',
    path: (
      <>
        <text x="12" y="17" textAnchor="middle" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="13" fill="white">P</text>
      </>
    ),
  },
  SUI: {
    bg: 'linear-gradient(135deg,#4BA2FF,#2E7DD9)',
    fg: '#fff',
    path: (
      <>
        <path d="M12 4 C7 8 5 11 5 13.5 C5 17.1 8.1 20 12 20 C15.9 20 19 17.1 19 13.5 C19 11 17 8 12 4Z" fill="white" opacity="0.9" />
      </>
    ),
  },
  AVAX: {
    bg: 'linear-gradient(135deg,#E84142,#C12E2F)',
    fg: '#fff',
    path: (
      <>
        <polygon points="12,4 20,19 4,19" fill="none" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
        <line x1="8" y1="15" x2="16" y2="15" stroke="white" strokeWidth="2" />
      </>
    ),
  },
  LINK: {
    bg: 'linear-gradient(135deg,#375BD2,#2649B8)',
    fg: '#fff',
    path: (
      <>
        <polygon points="12,4 19,8 19,16 12,20 5,16 5,8" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      </>
    ),
  },
  DOGE: {
    bg: 'linear-gradient(135deg,#C2A633,#A08920)',
    fg: '#fff',
    path: (
      <>
        <text x="12" y="17" textAnchor="middle" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="13" fill="white">Ð</text>
      </>
    ),
  },
};

const FALLBACK_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B',
  '#EF4444', '#10B981', '#3B82F6', '#F97316', '#84CC16',
];

function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length]!;
}

export function CoinIcon({ symbol, size = 24, className = '' }: CoinIconProps) {
  // Strip common suffixes like -PERP, -USD, /USDC
  const base = symbol.replace(/[-/](PERP|USD|USDC|USDT|BTC|ETH)$/, '').toUpperCase();
  const meta = COIN_META[base];
  const dim  = size;

  if (meta) {
    return (
      <div
        className={`flex items-center justify-center rounded-full shrink-0 overflow-hidden ${className}`}
        style={{ width: dim, height: dim, background: meta.bg }}
      >
        <svg viewBox="0 0 24 24" width={dim * 0.58} height={dim * 0.58}>
          {meta.path}
        </svg>
      </div>
    );
  }

  // Fallback: colored circle with initials
  const color = hashColor(base);
  const initials = base.slice(0, 2);
  return (
    <div
      className={`flex items-center justify-center rounded-full shrink-0 font-black ${className}`}
      style={{ width: dim, height: dim, background: color, fontSize: dim * 0.35, color: '#fff' }}
    >
      {initials}
    </div>
  );
}
