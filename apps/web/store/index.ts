import { create } from 'zustand';
import type { Market, Ticker } from '@repo/types';

interface WalletState {
  connected: boolean;
  publicKey: string | null;
  balance: number;
}

type WsStatus = 'disconnected' | 'connecting' | 'connected';

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
  // WebSocket
  wsStatus: WsStatus;
  setWsStatus: (status: WsStatus) => void;
  // Wallet
  wallet: WalletState;
  setConnected: (publicKey: string) => void;
  setDisconnected: () => void;
}

export const useKaidoStore = create<KaidoStore>((set) => ({
  activeMarket: 'SOL-PERP',
  markets: [],
  tickers: {},
  setActiveMarket: (symbol) => set({ activeMarket: symbol }),
  setMarkets: (markets) => set({ markets }),
  updateTicker: (ticker) =>
    set((state) => ({ tickers: { ...state.tickers, [ticker.symbol]: ticker } })),
  moreMenuOpen: false,
  toggleMoreMenu: () => set((state) => ({ moreMenuOpen: !state.moreMenuOpen })),
  wsStatus: 'disconnected',
  setWsStatus: (status) => set({ wsStatus: status }),
  wallet: { connected: false, publicKey: null, balance: 0 },
  setConnected: (publicKey) =>
    set({ wallet: { connected: true, publicKey, balance: 0 } }),
  setDisconnected: () =>
    set({ wallet: { connected: false, publicKey: null, balance: 0 } }),
}));
