import { JupiterClient } from './clients/jupiter.js';
import { PythClient }    from './clients/pyth.js';
import { HeliusClient }  from './clients/helius.js';
import { BirdeyeClient } from './clients/birdeye.js';
import { DeFiLlamaClient } from './clients/defillama.js';
import { DriftClient }   from './clients/drift.js';
import { SolanaRpcClient } from './clients/solana-rpc.js';

export type { WalletAsset, OrderLevel, Pool, WhaleTx, FundingRate, JupiterQuote, LogPoseConfig } from './types.js';
export { MINTS, DECIMALS } from './clients/jupiter.js';

export function createLogPoseSDK(config: LogPoseConfig) {
  const rpcUrl = config.rpcUrl ?? `https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`;
  return {
    jupiter:   new JupiterClient(),
    pyth:      new PythClient(),
    helius:    new HeliusClient(config.heliusApiKey, rpcUrl),
    birdeye:   new BirdeyeClient(config.birdeyeApiKey),
    defillama: new DeFiLlamaClient(),
    drift:     new DriftClient(),
    solana:    new SolanaRpcClient(rpcUrl),
  };
}

export type LogPoseSDK = ReturnType<typeof createLogPoseSDK>;
