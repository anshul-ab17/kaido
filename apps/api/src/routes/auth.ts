import type { FastifyPluginAsync } from 'fastify';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const NONCE_TTL = 300;

const challengeSchema = z.object({ walletAddress: z.string().min(32).max(44) });
const verifySchema = z.object({
  walletAddress: z.string(),
  signature: z.string(),
  nonce: z.string(),
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/challenge', async (request, reply) => {
    const { walletAddress } = challengeSchema.parse(request.body);
    const nonce = crypto.randomUUID();
    const message = `Sign in to Kaido\nWallet: ${walletAddress}\nNonce: ${nonce}`;
    await fastify.redis.setex(`nonce:${walletAddress}`, NONCE_TTL, nonce);
    return reply.send({ nonce, message, expiresAt: Date.now() + NONCE_TTL * 1000 });
  });

  fastify.post('/verify', async (request, reply) => {
    const { walletAddress, signature, nonce } = verifySchema.parse(request.body);
    const storedNonce = await fastify.redis.get(`nonce:${walletAddress}`);
    if (!storedNonce || storedNonce !== nonce) {
      return reply.code(401).send({ error: 'Invalid or expired nonce' });
    }
    const message = `Sign in to Kaido\nWallet: ${walletAddress}\nNonce: ${nonce}`;
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = bs58.decode(signature);
    const pubBytes = bs58.decode(walletAddress);
    const valid = nacl.sign.detached.verify(msgBytes, sigBytes, pubBytes);
    if (!valid) return reply.code(401).send({ error: 'Invalid signature' });
    await fastify.redis.del(`nonce:${walletAddress}`);
    const identity = await prisma.authIdentity.upsert({
      where: { type_address: { type: 'wallet', address: walletAddress } },
      create: { type: 'wallet', provider: 'phantom', address: walletAddress, user: { create: {} } },
      update: {},
      include: { user: true },
    });
    await prisma.user.update({ where: { id: identity.userId }, data: { lastLogin: new Date() } });
    const token = fastify.jwt.sign({ userId: identity.userId, walletAddress }, { expiresIn: '7d' });
    return reply.send({ token, userId: identity.userId, walletAddress, expiresAt: Date.now() + 7 * 86400_000 });
  });
};
