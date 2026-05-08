# Kaido

It's a hybrid dex exchange built on Solana.

## Project Structure

- `apps/web`: Next.js frontend application.
- `apps/api`: Fastify backend server.
- `packages/sdk`: Solana interaction logic and LogPose SDK.
- `packages/ui`: Shared UI components (Tailwind + shadcn/ui).
- `packages/types`: Common TypeScript definitions.
- `services/routing-engine`:  routing logic.

## Tech Stack

- **Frontend**: Next.js, TypeScript, TailwindCSS, Framer Motion.
- **Backend**: Fastify, Prisma, PostgreSQL, Redis.
- **Solana**: Jupiter, Drift, Orca, Meteora, OpenBook, Pyth, Helius, Anchor.
- **Design**: Stitch-designed

## Getting Started

1. Install dependencies: `npm install`
2. Run development environment: `npm run dev`