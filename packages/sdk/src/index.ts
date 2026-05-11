import type { LogPoseConfig } from './types.js';
import { JupiterClient } from './clients/jupiter.js';
import { PythClient }    from './clients/pyth.js';
import { HeliusClient }  from './clients/helius.js';
import { BirdeyeClient } from './clients/birdeye.js';
import { DeFiLlamaClient } from './clients/defillama.js';
import { DriftClient }   from './clients/drift.js';
import { SolanaRpcClient } from './clients/solana-rpc.js';
import { PolymarketClient } from './clients/polymarket.js';
import { JupiterPredictionClient } from './clients/jupiter-prediction.js';

export type { WalletAsset, OrderLevel, Pool, WhaleTx, FundingRate, JupiterQuote, LogPoseConfig, SolanaCluster } from './types.js';
export type { PolymarketTopic, PolymarketSubtopic } from './clients/polymarket.js';
export { POLY_GAMMA, POLY_DATA, POLY_CLOB } from './clients/polymarket.js';
export { MAINNET_MINTS, DEVNET_MINTS, DECIMALS } from './clients/jupiter.js';
export { JupiterPredictionClient, microToUsd, usdToMicro, microToProb, USDC_MINT } from './clients/jupiter-prediction.js';
export type { JupEvent, JupMarket, JupPosition, JupOrderResponse, JupCreateOrderParams } from './clients/jupiter-prediction.js';

function resolveRpcUrl(config: LogPoseConfig): string {
  if (config.rpcUrl) return config.rpcUrl;
  const cluster = config.cluster ?? 'devnet';
  if (cluster === 'devnet') {
    if (config.heliusApiKey) return `https://devnet.helius-rpc.com/?api-key=${config.heliusApiKey}`;
    return 'https://api.devnet.solana.com';
  }
  if (config.heliusApiKey) return `https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`;
  return 'https://api.mainnet-beta.solana.com';
}

export function createLogPoseSDK(config: LogPoseConfig) {
  const cluster = config.cluster ?? 'devnet';
  const rpcUrl  = resolveRpcUrl(config);
  return {
    jupiter:    new JupiterClient(cluster),
    pyth:       new PythClient(),
    helius:     new HeliusClient(config.heliusApiKey, rpcUrl, cluster),
    birdeye:    new BirdeyeClient(config.birdeyeApiKey),
    defillama:  new DeFiLlamaClient(),
    drift:      new DriftClient(cluster),
    solana:     new SolanaRpcClient(rpcUrl),
    polymarket: new PolymarketClient(),
    prediction: config.jupiterApiKey
      ? new JupiterPredictionClient(config.jupiterApiKey)
      : null as JupiterPredictionClient | null,
  };
}

export type LogPoseSDK = ReturnType<typeof createLogPoseSDK>;
