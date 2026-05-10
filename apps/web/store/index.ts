import { create } from 'zustand';
import type { Market, Ticker } from '@repo/types';

interface WalletState {
  connected: boolean;
  publicKey: string | null;
  balance: number;
  authToken: string | null;
}

type WsStatus = 'disconnected' | 'connecting' | 'connected';

export interface Toast {
  id: string;
  type: 'pending' | 'success' | 'error' | 'info';
  title: string;
  message?: string;
  signature?: string;
  duration?: number;
}

export interface EventPosition {
  eventId: string;
  title: string;
  category: string;
  resolutionDate: number;
  yesShares: number;
  noShares: number;
  yesCost: number;
  noCost: number;
  yesPrice: number;
  noPrice: number;
  yesValue: number;
  noValue: number;
}

interface KaidoStore {
  // Market
  activeMarket: string;
  markets: Market[];
  tickers: Record<string, Ticker>;
  setActiveMarket: (symbol: string) => void;
  setMarkets: (markets: Market[]) => void;
  updateTicker: (ticker: Ticker) => void;
  // UI
  moreMenuOpen: boolean;
  toggleMoreMenu: () => void;
  walletModalOpen: boolean;
  setWalletModalOpen: (open: boolean) => void;
  // WebSocket
  wsStatus: WsStatus;
  setWsStatus: (status: WsStatus) => void;
  // Wallet + Auth
  wallet: WalletState;
  setConnected: (publicKey: string, authToken?: string) => void;
  setDisconnected: () => void;
  // Watchlist
  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  // Event positions
  eventPositions: EventPosition[];
  addEventPosition: (pos: EventPosition) => void;
  updateEventPosition: (pos: EventPosition) => void;
  refreshEventPositions: () => Promise<void>;
}

function loadWatchlist(): string[] {
  try {
    return JSON.parse(localStorage.getItem('kaido_watchlist') ?? '[]') as string[];
  } catch { return []; }
}

function loadAuthToken(): string | null {
  try { return localStorage.getItem('kaido_auth_token'); } catch { return null; }
}

function loadPublicKey(): string | null {
  try { return localStorage.getItem('kaido_public_key'); } catch { return null; }
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export const useKaidoStore = create<KaidoStore>((set, get) => ({
  activeMarket: 'SOL-PERP',
  markets: [],
  tickers: {},
  setActiveMarket: (symbol) => set({ activeMarket: symbol }),
  setMarkets: (markets) => set({ markets }),
  updateTicker: (ticker) =>
    set((state) => ({ tickers: { ...state.tickers, [ticker.symbol]: ticker } })),

  moreMenuOpen: false,
  toggleMoreMenu: () => set((state) => ({ moreMenuOpen: !state.moreMenuOpen })),

  walletModalOpen: false,
  setWalletModalOpen: (open) => set({ walletModalOpen: open }),

  wsStatus: 'disconnected',
  setWsStatus: (status) => set({ wsStatus: status }),

  wallet: {
    connected: false,
    publicKey: typeof window !== 'undefined' ? loadPublicKey() : null,
    balance: 0,
    authToken: typeof window !== 'undefined' ? loadAuthToken() : null,
  },
  setConnected: (publicKey, authToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('kaido_public_key', publicKey);
      if (authToken) localStorage.setItem('kaido_auth_token', authToken);
    }
    set({ wallet: { connected: true, publicKey, balance: 0, authToken: authToken ?? null } });
    // Refresh event positions after connecting
    void get().refreshEventPositions();
  },
  setDisconnected: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kaido_public_key');
      localStorage.removeItem('kaido_auth_token');
    }
    set({ wallet: { connected: false, publicKey: null, balance: 0, authToken: null }, eventPositions: [] });
  },

  watchlist: typeof window !== 'undefined' ? loadWatchlist() : [],
  addToWatchlist: (symbol) => {
    const next = [...new Set([...get().watchlist, symbol])];
    localStorage.setItem('kaido_watchlist', JSON.stringify(next));
    set({ watchlist: next });
  },
  removeFromWatchlist: (symbol) => {
    const next = get().watchlist.filter((s) => s !== symbol);
    localStorage.setItem('kaido_watchlist', JSON.stringify(next));
    set({ watchlist: next });
  },

  toasts: [],
  addToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    const full: Toast = { ...toast, id, duration: toast.duration ?? 5000 };
    set((state) => ({ toasts: [...state.toasts, full] }));
    setTimeout(() => get().removeToast(id), full.duration);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  eventPositions: [],
  addEventPosition: (pos) =>
    set((state) => ({
      eventPositions: [...state.eventPositions.filter((p) => p.eventId !== pos.eventId), pos],
    })),
  updateEventPosition: (pos) =>
    set((state) => ({
      eventPositions: state.eventPositions.map((p) => (p.eventId === pos.eventId ? pos : p)),
    })),
  refreshEventPositions: async () => {
    const { wallet } = get();
    if (!wallet.connected || !wallet.publicKey) return;
    try {
      const res = await fetch(`${API_URL}/events/positions/all?wallet=${wallet.publicKey}`);
      if (!res.ok) return;
      const data = (await res.json()) as { positions: EventPosition[] };
      set({ eventPositions: data.positions });
    } catch { /* silently ignore */ }
  },
}));
