# Kairo

> **Aerodrome Safe LP Agent** · Your agent acts. Kairo decides.

Kairo is a consent and policy layer for autonomous LP management on Base. A user installs the **Aerodrome Steward** agent, sets a leash in plain English ("rebalance up to $500, only into vetted pools, only if APR uplift beats 4%"), and Kairo enforces it. Every decision lands as a public, verifiable receipt.

[Live demo](https://kairo.dev) · [Demo video](#) · [Documentation](./docs/PRODUCT.md) · [Architecture](./docs/ARCHITECTURE.md)

---

## Why Kairo

**The problem.** AI agents are increasingly trusted with on-chain action. Today the only two options are "give the agent your private key" or "approve every transaction yourself." Neither scales. Real LP autopilots need to act on signals you'd never see in time — gauge weight shifts, emissions changes, depegs — but they need a leash short enough to keep you in custody.

**The pattern.** A consent layer that sits between autonomous agents and the user's wallet. Three guarantees:

1. **On-chain policy enforcement.** Your policy lives in `KairoPolicy.sol` on Base. The off-chain engine *reads* from it as the source of truth — your leash can't be silently rewritten by a compromised server.
2. **Aerodrome-native rules.** Generic spend caps aren't enough for LP. Kairo's policy primitives include min APR delta, max impermanent loss tolerance, pool allowlist, gauge allowlist, and an auto-claim threshold.
3. **Simulation-first.** Every proposal is simulated against live chain state before the user is asked. No surprise calldata, no waste-gas reverts.

---

## The Steward agent

**Aerodrome Steward** is the demo agent that ships with v1. It runs on a schedule:

- Reads the user's Aerodrome positions from Base mainnet
- Reads live gauge weights from `Voter.sol` to spot emission shifts
- Proposes typed actions: `rebalance`, `claim_rewards`, `add_liquidity`, `vote_for_gauge`, `swap`
- Every proposal is simulated, evaluated against the user's policy, and either auto-approved, queued for the user, or denied — with the full reasoning attached to the receipt

The persona is **Mei**, a part-time LP with ~$5k across 2–3 Aerodrome pools who wants yield without checking gauges every Sunday. Full persona spec in [`docs/PRODUCT.md`](./docs/PRODUCT.md).

---

## What ships today

| Capability | Status |
|---|---|
| Policy engine, LP-aware rules | ✅ `16/16` TypeScript tests |
| Plain-English policy parser | ✅ `23/23` TypeScript tests |
| On-chain policy registry | ✅ `17/17` Solidity tests (`contracts/`) |
| `KairoPolicy.sol` deployed to Base Sepolia | ✅ [`0xE080…B13A`](https://sepolia.basescan.org/address/0xE08065110d0d7E63582942447973f895bC35B13A) |
| Aerodrome reads on Base mainnet | ✅ live verified |
| Live gauge intelligence (Voter + Gauge contracts) | ✅ vote-weighted APR estimation |
| Receipt minting + public pages | ✅ `/r/<hash>` with OG-card images |
| Next.js dashboard (Positions, Agents, Policy, Receipts, Arena) | ✅ prod build passes |
| wagmi + RainbowKit wallet connect | ✅ |
| MCP server for any agent (Claude / Cursor / ElizaOS / OpenClaw) | ✅ `apps/mcp/` |
| Rogue Steward 3-scenario demo | ✅ `pnpm rogue 0x…` |
| Steward agent cron loop with real on-chain signals | ✅ `agents/steward/` |
| Rust plugin alternative to MCP | 🟡 planned post-v1 |
| ERC-8004 agent identity | 🟡 planned post-v1 |
| On-chain `setPolicy()` write flow from the dashboard | 🟡 planned this week |

---

## The "Rogue Steward" demo

Three scenarios, one wallet, ninety seconds:

1. **Auto-approved.** Steward proposes a $200 rebalance with +5.2% APR delta. Within policy. Auto-executes. Receipt logged.
2. **Asks first.** Steward proposes a $1,500 rebalance. Over the per-action cap. Routed to the user — receipt lands as `pending_user`. User taps Approve in the dashboard.
3. **Blocked.** Steward proposes adding liquidity to a pool not on the user's allowlist. Denied at the policy layer. Receipt records the rejected attempt with the exact rule that triggered.

Run it locally:

```bash
pnpm dev                   # in one terminal
pnpm rogue 0xYourWallet    # in another
```

Three receipts appear in the dashboard within seconds. Each one has a public shareable URL with an OG-card preview optimized for Twitter/Farcaster.

---

## Architecture

```
                     ┌──────────────────────┐
                     │   Aerodrome Steward  │
                     │   (Node cron, v1)    │
                     └──────────┬───────────┘
                                │ proposal (typed)
                                ▼
   ┌──────────────────────────────────────────────────┐
   │  Kairo API (Next.js, Vercel)                     │
   │  ┌─────────────┐  ┌────────────┐  ┌──────────┐  │
   │  │ Policy      │  │ Simulator  │  │ Receipts │  │
   │  │ engine      │←─│ (viem +    │─→│ (public, │  │
   │  │             │  │  Anvil)    │  │  signed) │  │
   │  └──────┬──────┘  └────────────┘  └──────────┘  │
   └─────────┼────────────────────────────────────────┘
             │ reads source of truth
             ▼
   ┌──────────────────────────────┐    ┌─────────────────┐
   │ KairoPolicy.sol (Base Sepolia)│   │ Aerodrome       │
   │  immutable rule registry      │    │ (Base mainnet)  │
   └──────────────────────────────┘    └─────────────────┘

                                  ┌──────────────────────┐
   MCP-compatible agents ─────────│  Kairo MCP server    │
   (Claude · Cursor · ElizaOS)    │  five typed tools    │
                                  └──────────────────────┘
```

Full system diagram and trust boundaries in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Repo layout

```
kairo/
├── apps/
│   ├── web/                 # Next.js 15 — dashboard, public receipts, API
│   └── mcp/                 # MCP server for any MCP-compatible agent
├── packages/
│   ├── policy/              # LP-aware policy engine (pure TS, 39 tests)
│   └── sdk/                 # Aerodrome SDK — live reads, gauge intelligence
├── contracts/               # KairoPolicy.sol + Foundry tests (17 tests)
├── agents/
│   └── steward/             # The Aerodrome LP autopilot (Node cron)
├── scripts/                 # Smoke tests, demo seeds, Rogue Steward
└── docs/                    # Product, architecture, brand, roadmap, how-to
```

---

## Quick start

```bash
pnpm install
pnpm --filter web exec prisma db push        # local SQLite
pnpm dev                                      # http://localhost:3000

# Seed the dashboard with three demo receipts (in another terminal)
pnpm rogue 0xYourWallet

# Run the contract test suite
pnpm contracts:test
```

Optional: run the Steward agent loop against a real Base wallet that holds Aerodrome LP positions:

```bash
STEWARD_WALLET=0xYourWallet pnpm steward
```

---

## What makes Kairo different

- **Aerodrome-native policy primitives.** APR delta thresholds, impermanent loss tolerance, pool/gauge allowlists, auto-claim limits. Rules that actually mean something for LP, not generic spend caps.
- **On-chain enforcement on Base.** `KairoPolicy.sol` is the source of truth; the off-chain engine reads from it and refuses to forward any action that exceeds the rules.
- **Simulation-first proposals.** Every action is forked-simulated against live chain state before the user is asked.
- **Public, shareable receipts.** Every decision becomes a URL with an OG-card preview. The audit trail is a product surface, not a debugging tool.
- **Plain-English policy.** Type your leash in natural language — *"rebalance up to $500, only if APR uplift beats 4%, auto-claim under $50"* — and Kairo parses it into structured rules.
- **Agent-runtime portable.** Kairo exposes its policy engine and Aerodrome intelligence via an MCP server. Any MCP-compatible agent (Claude, Cursor, ElizaOS, OpenClaw, Nanobot) can ask Kairo *"would this action be allowed?"* before broadcasting.

---

## Use with any agent runtime

Kairo is non-custodial and runtime-agnostic. The agent that proposes actions can be:

- A locally-running Node cron (what ships in v1, `agents/steward/`)
- A Claude Code or Cursor session calling Kairo's MCP tools
- An ElizaOS / OpenClaw agent via the same MCP server
- A future Rust plugin for the Aomi runtime
- Your own custom agent — just POST proposals to `/api/proposals`

The leash is the same in every case. The user's wallet never leaves their custody.

---

## Acknowledgements

- **[Aerodrome](https://aerodrome.finance)** — the LP venue Kairo is built around.
- **[Base](https://base.org)** — the L2 Kairo settles on.
- **[Foundry](https://book.getfoundry.sh)**, **[wagmi](https://wagmi.sh)**, **[viem](https://viem.sh)**, **[shadcn/ui](https://ui.shadcn.com)** — the tools that made shipping this in days, not months, possible.

## License

MIT.
