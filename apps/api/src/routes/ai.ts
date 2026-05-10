import type { FastifyPluginAsync } from 'fastify';
import { config } from '../config.js';

interface ChatMessage { role: 'user' | 'assistant'; content: string }

function buildSystemPrompt(prices: Record<string, number>): string {
  const sol = prices['SOL-PERP']?.toFixed(2) ?? 'unavailable';
  const btc = prices['BTC-PERP']?.toFixed(0) ?? 'unavailable';
  const eth = prices['ETH-PERP']?.toFixed(0) ?? 'unavailable';

  return `You are Kaido AI, an expert trading copilot for the Kaido DEX — an AI-native perpetuals and prediction market exchange built on Solana.

You have deep expertise in:
- Solana DeFi ecosystem (Jupiter, Orca, Drift, OpenBook, Pyth, Helius)
- Perpetual futures trading (funding rates, liquidation mechanics, margin)
- Prediction markets (AMM pricing, YES/NO resolution)
- On-chain analytics (whale activity, liquidity depth, market microstructure)
- Risk management and portfolio analysis

Current live market prices (from Pyth Network, updated at request time):
- SOL-PERP: $${sol}
- BTC-PERP: $${btc}
- ETH-PERP: $${eth}

Keep responses concise, data-driven, and actionable. Use specific numbers when discussing prices or risk.
Format key insights with bullet points. Never give financial advice — provide analysis only.`;
}

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { messages: ChatMessage[] } }>('/ai/chat', async (request, reply) => {
    const { messages } = request.body;
    if (!messages?.length) return reply.code(400).send({ error: 'messages required' });

    if (!config.ANTHROPIC_API_KEY) {
      return reply.code(503).send({ error: 'AI copilot requires ANTHROPIC_API_KEY — not configured' });
    }

    const prices = await fastify.sdk.pyth.getPrices().catch(() => ({} as Record<string, number>));

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         config.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        system:     buildSystemPrompt(prices),
        messages:   messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.text();
      fastify.log.error('Anthropic API error:', err);
      return reply.code(502).send({ error: `AI service error: ${res.status}` });
    }

    const data = (await res.json()) as { content: Array<{ text: string }> };
    return reply.send({ content: data.content[0]?.text ?? '' });
  });
};
