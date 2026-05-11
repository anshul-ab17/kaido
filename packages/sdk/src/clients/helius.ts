import type { WalletAsset, WhaleTx } from '../types.js';
import type { SolanaCluster } from '../types.js';

const JUPITER_PROGRAM = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';

interface HeliusFungibleToken {
  interface: string;
  id:         string;
  token_info?: {
    symbol:     string;
    balance:    number;
    decimals:   number;
    price_info?: { price_per_token: number; currency: string };
  };
}

interface HeliusNativeBalance {
  lamports:      number;
  price_per_sol: number;
}

interface HeliusEnhancedTx {
  signature:        string;
  timestamp:        number;
  type:             string;
  source?:          string;
  nativeTransfers?: Array<{ amount: number; fromUserAccount: string; toUserAccount: string }>;
  tokenTransfers?:  Array<{ mint: string; tokenAmount: number; fromUserAccount: string; toUserAccount: string }>;
}

export class HeliusClient {
  private dasUrl: string;
  private apiUrl: string;
  private apiKey: string;
  private readonly devnet: boolean;

  constructor(apiKey: string | undefined, rpcUrl: string | undefined, cluster: SolanaCluster = 'devnet') {
    this.devnet = cluster === 'devnet';
    this.apiKey = apiKey ?? '';
    this.dasUrl =
      rpcUrl ??
      (this.apiKey
        ? this.devnet
          ? `https://devnet.helius-rpc.com/?api-key=${this.apiKey}`
          : `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`
        : this.devnet
          ? 'https://api.devnet.solana.com'
          : 'https://api.mainnet-beta.solana.com');
    this.apiUrl = `https://api.helius.xyz/v0`;
  }

  async getWalletAssets(walletAddress: string): Promise<WalletAsset[]> {
    const res = await fetch(this.dasUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 'kaido',
        method:  'getAssetsByOwner',
        params:  {
          ownerAddress:   walletAddress,
          page:           1,
          limit:          100,
          displayOptions: { showFungible: true, showNativeBalance: true },
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Helius DAS ${res.status}`);

    const data = (await res.json()) as {
      result: { items: HeliusFungibleToken[]; nativeBalance?: HeliusNativeBalance };
    };

    const assets: WalletAsset[] = [];

    if (data.result.nativeBalance) {
      const nb  = data.result.nativeBalance;
      const sol = nb.lamports / 1e9;
      assets.push({ symbol: 'SOL', amount: sol, usdValue: sol * nb.price_per_sol, price: nb.price_per_sol });
    }

    for (const item of data.result.items) {
      if (item.interface === 'FungibleToken' && item.token_info) {
        const ti     = item.token_info;
        const amount = ti.balance / Math.pow(10, ti.decimals);
        const price  = ti.price_info?.price_per_token ?? 0;
        if (amount * price > 0.01) {
          assets.push({ symbol: ti.symbol ?? item.id.slice(0, 6), amount, usdValue: amount * price, price });
        }
      }
    }

    return assets;
  }

  async getLargeTransactions(minUsdValue: number, limit = 20): Promise<WhaleTx[]> {
    if (this.devnet || !this.apiKey) return [];

    const url = `${this.apiUrl}/addresses/${JUPITER_PROGRAM}/transactions?api-key=${this.apiKey}&limit=100&type=SWAP`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Helius enhanced txs ${res.status}`);

    const txs = (await res.json()) as HeliusEnhancedTx[];
    const results: WhaleTx[] = [];

    for (const tx of txs) {
      const nativeAmt = (tx.nativeTransfers?.[0]?.amount ?? 0) / 1e9;
      const approxUsd = nativeAmt * 200;
      if (approxUsd < minUsdValue && !tx.tokenTransfers?.length) continue;

      results.push({
        id:        tx.signature,
        type:      tx.type === 'SWAP' ? 'swap' : 'transfer',
        asset:     tx.nativeTransfers?.[0] ? 'SOL' : (tx.tokenTransfers?.[0]?.mint?.slice(0, 6) ?? 'TOKEN'),
        amount:    nativeAmt || (tx.tokenTransfers?.[0]?.tokenAmount ?? 0),
        usdValue:  approxUsd,
        venue:     tx.source ?? 'Jupiter',
        from:      abbrev(tx.nativeTransfers?.[0]?.fromUserAccount ?? ''),
        to:        abbrev(tx.nativeTransfers?.[0]?.toUserAccount ?? tx.source ?? 'DEX'),
        signature: tx.signature.slice(0, 8) + '…',
        timestamp: new Date(tx.timestamp * 1000).toISOString(),
      });

      if (results.length >= limit) break;
    }

    return results;
  }
}

function abbrev(addr: string): string {
  if (!addr || addr.length < 8) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
