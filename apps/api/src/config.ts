import { z } from 'zod';

const schema = z.object({
  DATABASE_URL:       z.string().url(),
  REDIS_URL:          z.string(),
  NATS_URL:           z.string().default('nats://localhost:4222'),
  JWT_SECRET:         z.string().min(32),
  ROUTING_ENGINE_URL: z.string().url().default('http://localhost:5000'),
  /** Solana cluster for RPC, Helius, Jupiter, Drift — default devnet for local/staging. */
  SOLANA_CLUSTER:     z.enum(['mainnet-beta', 'devnet']).default('devnet'),
  /** Optional explicit RPC URL (overrides cluster-based default). */
  SOLANA_RPC_URL:     z.string().url().optional(),
  HELIUS_API_KEY:     z.string().optional(),
  BIRDEYE_API_KEY:    z.string().optional(),
  ANTHROPIC_API_KEY:   z.string().optional(),
  JUPITER_API_KEY:     z.string().optional(),
  PORT:               z.coerce.number().default(4000),
  NODE_ENV:           z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
