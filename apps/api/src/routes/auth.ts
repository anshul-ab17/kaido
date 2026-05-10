import type { FastifyPluginAsync } from 'fastify';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { z } from 'zod';
import { prisma } from '@repo/db';

const NONCE_TTL = 300; // 5 minutes

const challengeSchema = z.object({ walletAddress: z.string().min(32).max(44) });

const verifySchema = z.object({
  walletAddress: z.string(),
  /** Ed25519 signature — bs58 OR base64 encoded */
  signature: z.string(),
  nonce: z.string(),
  /** Default 'bs58'. Use 'base64' when signing via window.solana in the browser. */
  encoding: z.enum(['bs58', 'base64']).default('bs58'),
});

function decodeSignature(sig: string, encoding: 'bs58' | 'base64'): Uint8Array {
  if (encoding === 'base64') {
    const bin = atob(sig);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  return bs58.decode(sig);
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /auth/challenge — returns nonce + message to sign
  fastify.post('/challenge', async (request, reply) => {
    const { walletAddress } = challengeSchema.parse(request.body);
    const nonce = crypto.randomUUID();
    const message = `Sign in to Kaido\nWallet: ${walletAddress}\nNonce: ${nonce}`;
    await fastify.cache.setex(`nonce:${walletAddress}`, NONCE_TTL, nonce);
    return reply.send({ nonce, message, expiresAt: Date.now() + NONCE_TTL * 1000 });
  });

  // POST /auth/verify — verifies Ed25519 sig, upserts user, returns JWT
  fastify.post('/verify', async (request, reply) => {
    const { walletAddress, signature, nonce, encoding } = verifySchema.parse(request.body);

    const storedNonce = await fastify.cache.get(`nonce:${walletAddress}`);
    if (!storedNonce || storedNonce !== nonce) {
      return reply.code(401).send({ error: 'Invalid or expired nonce — request a new challenge' });
    }

    const message  = `Sign in to Kaido\nWallet: ${walletAddress}\nNonce: ${nonce}`;
    const msgBytes = new TextEncoder().encode(message);
    let valid = false;
    try {
      const sigBytes = decodeSignature(signature, encoding);
      const pubBytes = bs58.decode(walletAddress);
      valid = nacl.sign.detached.verify(msgBytes, sigBytes, pubBytes);
    } catch {
      return reply.code(401).send({ error: 'Signature decoding failed' });
    }

    if (!valid) return reply.code(401).send({ error: 'Invalid signature' });

    await fastify.cache.del(`nonce:${walletAddress}`);

    const identity = await prisma.authIdentity.upsert({
      where: { type_address: { type: 'wallet', address: walletAddress } },
      create: { type: 'wallet', provider: 'siws', address: walletAddress, user: { create: {} } },
      update: {},
      include: { user: true },
    });
    await prisma.user.update({ where: { id: identity.userId }, data: { lastLogin: new Date() } });

    const token = fastify.jwt.sign({ userId: identity.userId, walletAddress }, { expiresIn: '7d' });
    return reply.send({ token, userId: identity.userId, walletAddress, expiresAt: Date.now() + 7 * 86_400_000 });
  });

  // POST /auth/refresh — validate existing JWT, issue new one
  fastify.post('/refresh', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { userId: string; walletAddress: string };
    const token = fastify.jwt.sign({ userId: user.userId, walletAddress: user.walletAddress }, { expiresIn: '7d' });
    return reply.send({ token, expiresAt: Date.now() + 7 * 86_400_000 });
  });
};
