import type { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

export interface WalletAdapter {
  publicKey: PublicKey | null;
  connected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

export interface WalletAdapterEvents {
  onConnect(publicKey: PublicKey): void;
  onDisconnect(): void;
  onError(error: Error): void;
}
