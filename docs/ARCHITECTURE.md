# Kairo — Architecture

## System at a glance

```
┌──────────────────────────────────────────────────────────────────┐
│                          USER (Mei)                              │
│   ┌────────────────────┐         ┌─────────────────────────┐    │
│   │  Telegram          │         │  PWA (app.kairo.dev)    │    │
│   │  • approval inbox  │         │  • positions            │    │
│   │  • notifications   │         │  • policy editor        │    │
│   │  • inline buttons  │         │  • receipt timeline     │    │
│   └─────────┬──────────┘         └────────────┬────────────┘    │
└─────────────┼──────────────────────────────────┼─────────────────┘
              │                                  │
              │           ┌──────────────────────┘
              ▼           ▼
       ┌─────────────────────────────────┐
       │      Kairo API (apps/web)       │
       │  • policy evaluation            │
       │  • receipt minting              │
       │  • Telegram webhook             │
       │  • Para wallet session          │
       └──────────────┬──────────────────┘
                      │
        ┌─────────────┼───────────────┐
        ▼             ▼               ▼
  ┌───────────┐ ┌────────────┐ ┌────────────────┐
  │ Vercel KV │ │   Aomi     │ │  Aerodrome     │
  │ receipts, │ │  Runtime   │ │  plugin (Rust) │
  │ policies, │ │  • LLM     │ │  via aomi-sdk  │
  │ sessions  │ │  • Anvil   │ │                │
  └───────────┘ │  • tools   │ └────────┬───────┘
                └──────┬─────┘          │
                       │                ▼
                       │         ┌──────────────┐
                       └────────▶│   Base       │
                                 │  (Sepolia    │
                                 │   then       │
                                 │   mainnet)   │
                                 └──────────────┘
```

## The action lifecycle

This is the single most important sequence in the system. Memorize it.

```
1. SCHEDULE         Steward agent wakes (cron, every 6h)
2. OBSERVE          Calls aerodrome.get_positions for Mei's wallet
3. THINK            LLM decides: "rebalance into sAMM-USDC/USDT"
4. PROPOSE          Calls aerodrome.simulate_rebalance — returns
                    typed proposal: { from, to, amount, projected_apr_delta }
5. SIMULATE         Aomi forks Base via Anvil, runs the tx, returns
                    token deltas + gas
6. EVALUATE         Kairo policy engine checks the proposal +
                    simulation against Mei's rules:
                      - spend <= cap?           → ok
                      - pool in allowlist?       → ok
                      - apr_delta >= threshold?  → ok
                      - within daily cap?        → ok
                    → AUTO_APPROVE
                    (any miss → REQUIRES_APPROVAL)
                    (explicit block → DENIED)
7a. AUTO_APPROVE   → execute via Aomi → tx hash
7b. REQUIRES_APPROVAL → Telegram message to Mei with
                       inline Approve/Deny buttons
                       (15-minute timeout, then auto-deny)
7c. DENIED        → no tx, receipt logged as blocked
8. EXECUTE         Aomi proposes tx → Para signs locally → broadcasts
9. RECEIPT         Mint receipt with: agent, proposal, simulation,
                   policy_decision, decision_actor (auto|user),
                   tx_hash (if executed), public_url
10. NOTIFY        Telegram: "Done. View receipt: kairo.dev/r/<hash>"
```

## Packages

### `plugins/aerodrome/` — Rust, `aomi-sdk`

The agent's hands on Aerodrome.

Tools exposed:
- `get_positions(wallet) -> Position[]`
- `quote_swap(from, to, amount) -> Quote`
- `simulate_rebalance(from_pool, to_pool, amount) -> RebalanceProposal`
- `claim_rewards(pool) -> ClaimProposal`
- `vote_for_gauge(gauge, weight) -> VoteProposal`

Each tool returns a *typed proposal* — never executes directly. The plugin builds calldata; Aomi simulates; Kairo decides; Para signs.

### `packages/policy/` — TypeScript

The policy engine. Pure functions over typed proposals.

```ts
type Policy = {
  mode: 'ask_every' | 'allow_under_limits' | 'block'
  rules: {
    max_spend_per_action_usd: number
    daily_cap_usd: number
    pool_allowlist: Address[]
    gauge_allowlist: Address[]
    min_apr_delta_bps: number      // basis points (400 = 4%)
    max_impermanent_loss_bps: number
    claim_schedule_cron?: string
  }
}

type Decision =
  | { kind: 'auto_approve', matched_rules: string[] }
  | { kind: 'requires_approval', reason: string }
  | { kind: 'denied', reason: string }

function evaluate(proposal: Proposal, policy: Policy, history: Receipt[]): Decision
```

The engine is dependency-free (no LLM, no chain calls) so it's testable and fast.

### `packages/sdk/` — TypeScript

Client used by the Steward agent and any future agent. Wraps:
- Aomi runtime calls
- Kairo API (submit proposal, fetch decision, register agent)
- Receipt minting

### `apps/web/` — Next.js 15, App Router

Three roles in one app:
- **Marketing site** (`/`): one-screen pitch, screenshot, CTA
- **PWA dashboard** (`/app/*`): positions, policy editor, timeline
- **Public receipts** (`/r/[hash]`): SSR'd, OG-optimized
- **API routes** (`/api/*`): policy evaluation, Telegram webhook, receipt write/read

### `agents/steward/` — Aomi App config

A small repo of:
- `system-prompt.md`
- `tools.json` (which plugin tools, which model)
- `schedule.json` (cron, frequency, max actions per cycle)
- `install.json` (defaults when a user installs Steward)

## Storage

- **Vercel KV** for v1: policies, receipts, Telegram chat ↔ wallet links, agent install records.
- **Postgres later** if we add team mode or analytics. Not v1.
- **On-chain receipts** are explicitly v2 — we will publish a content hash to EAS or a tiny contract once the off-chain pipeline is solid.

## Trust boundaries

- **Aomi runtime** is trusted to simulate accurately and not leak private keys (it never holds them).
- **Para** is trusted to sign locally. User retains custody.
- **Kairo API** is trusted with policies and receipts but not with private keys. A compromised Kairo can deny actions but cannot move funds.
- **The Aerodrome plugin** is trusted to build correct calldata. Simulation is the safety net.

The reduction: even if Kairo's API server is fully owned by an attacker, the worst they can do is deny legitimate actions or approve actions the user already allowed under policy. They cannot exfiltrate funds.

## Out of scope for v1 (explicit)

- Multi-sig style M-of-N approvals
- Session keys / EIP-7702 batched custody
- ZK proofs of policy adherence
- Cross-chain anything
- Anything but Aerodrome
