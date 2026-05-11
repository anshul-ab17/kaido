'use client';

import { type ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';

const ENDPOINT =
  process.env['NEXT_PUBLIC_SOLANA_RPC'] ?? 'https://api.devnet.solana.com';

export function SolanaProviders({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={ENDPOINT}>
      {/* Phantom, Backpack, and Solflare all implement the Wallet Standard
          and are auto-detected — no need to pass explicit adapters */}
      <WalletProvider wallets={[]} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
