import { z } from 'zod';

const schema = z.object({
  DATABASE_URL:       z.string().url(),
  REDIS_URL:          z.string(),
  NATS_URL:           z.string().default('nats://localhost:4222'),
  JWT_SECRET:         z.string().min(32),
  ROUTING_ENGINE_URL: z.string().url().default('http://localhost:5000'),
  HELIUS_API_KEY:     z.string().min(1, 'HELIUS_API_KEY is required'),
  BIRDEYE_API_KEY:    z.string().optional(),
  ANTHROPIC_API_KEY:  z.string().optional(),
  PORT:               z.coerce.number().default(4000),
  NODE_ENV:           z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
