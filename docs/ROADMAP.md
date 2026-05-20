# Kairo — Roadmap

## Phase 0: Today (May 17) — MVP end-to-end

Goal: a real, working product. Not a mockup, not a slide deck. A user can connect a wallet, install Steward, set a policy, and see the agent propose and execute (on an Anvil fork of Base mainnet) with real Aerodrome calldata.

- [x] Repo scaffold, docs, brand
- [ ] Next.js 15 app initialized with TypeScript, Tailwind, shadcn
- [ ] wagmi + RainbowKit wired to Base mainnet (read) + local Anvil fork (write)
- [ ] Policy engine package (`packages/policy`) with unit tests
- [ ] Storage: SQLite via Prisma (will swap to Vercel KV for deploy)
- [ ] API routes: proposals, decisions, receipts, policies
- [ ] Aerodrome reads via viem: positions, pool info, gauge weights
- [ ] PWA pages: positions, policy editor, receipts timeline, public receipt
- [ ] OG image route for receipt sharing
- [ ] Steward agent: Node.js cron, proposes rebalances, calls Kairo API
- [ ] Anvil fork integration for simulation + execution
- [ ] Polish pass on the 5 critical screens
- [ ] Logo and landing page
- [ ] Deploy to Vercel (preview, not production)
- [ ] README + how-to-use doc

## Phase 1: May 18–22 — Polish + real Telegram

- [ ] Telegram bot for approvals (replace local notification)
- [ ] Refined design system pass with real designer-quality screens
- [ ] Onboarding flow polished to under 2 minutes
- [ ] Receipt OG images: real product photography quality
- [ ] Marketing site copy pass
- [ ] Twitter page live with logo
- [ ] First public demo video draft

## Phase 2: May 23–27 — Aomi integration

- [ ] Replace local agent loop with Aomi-hosted runtime
- [ ] Migrate Aerodrome tool calls from direct viem to a Rust plugin via `aomi-sdk`
- [ ] Use Aomi's Anvil simulation pipeline directly (drop our local fork)
- [ ] Optional: Para wallet path alongside wagmi
- [ ] Final demo video

## Phase 3: May 28–30 — Submission

- [ ] Final polish pass
- [ ] Mainnet flag for read-only demo on real positions
- [ ] Blog post: "How Kairo turns Aerodrome into a policy-gated agent surface"
- [ ] Submit to active hackathons / grant programs
- [ ] Push for GitHub stars

## Phase 4: Post-submission (retainer track)

- [ ] Multi-protocol policies: Zora, Limitless, Avantis
- [ ] iOS native via Capacitor or React Native
- [ ] On-chain receipts via EAS attestations
- [ ] Team / shared-policy mode
- [ ] Browser extension surface
- [ ] Public agent registry
