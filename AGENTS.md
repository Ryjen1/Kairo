# Agent Notes — Kairo

Read this first if you (Kilo or another agent) are picking up work on this repo.

## What this project is

Kairo is the consent and policy layer for autonomous crypto agents on Base. Built for the OpenPandora Early Forge bounty targeting the Aerodrome track.

The single source of truth is `docs/PRODUCT.md`. The persona is **Mei**, a part-time Aerodrome LP. Every UX decision should ask "would Mei understand this?"

## Conventions

- **Package manager**: `pnpm` (10.x). Use workspace protocol for internal deps.
- **Node**: 24.x
- **TypeScript**: strict mode, no `any` except at typed boundaries we own
- **Web framework**: Next.js 15, App Router
- **UI**: Tailwind + shadcn. Tokens defined in `apps/web/app/globals.css`
- **Wallet**: wagmi + RainbowKit for v1. Para integration deferred.
- **Chain**: Base mainnet for reads; local Anvil fork of mainnet for execution in v1
- **Storage**: SQLite via Prisma locally, Vercel KV for deploy
- **State**: zustand for client state. React Query for server state.
- **Tests**: vitest for unit tests, especially the policy engine
- **Branding**: Lowercase `kairo` everywhere. Two-tone dark UI. No emoji in product copy. See `docs/BRAND.md`.

## What NOT to do

- Do not introduce Solana code. This is a Base/EVM project.
- Do not reference SkillGuard. The architecture is informed by reading SkillGuard's public repo but no code is copied. The brand, voice, and primitives are independent.
- Do not add features outside the v1 scope in `docs/PRODUCT.md` without explicit user approval. Scope creep kills this.
- Do not add emoji to product copy. One emoji per screen, max.
- Do not use the word "firewall", "guardrails", "permissions manager", or "wallet protector" in product copy. See `docs/BRAND.md`.

## Aerodrome addresses (Base mainnet)

Pinned from the official `aerodrome-finance/contracts` repo:

| Contract | Address |
|---|---|
| Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| VotingEscrow | `0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4` |

Use Base mainnet (chain id 8453) for reads. Local Anvil fork for writes during dev.

## Workflow

1. Read `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` before coding
2. Pick the next unchecked item in `docs/ROADMAP.md` Phase 0
3. Use TodoWrite to track sub-tasks
4. Keep commits small and labeled by package: `web:`, `policy:`, `sdk:`, `steward:`, `docs:`

## Commands

```bash
pnpm install                          # install all workspaces
pnpm --filter web dev                 # run the web app
pnpm --filter policy test             # run policy engine tests
pnpm --filter steward start           # run the steward agent loop
pnpm anvil:fork                       # start a Base mainnet fork on :8545
```
