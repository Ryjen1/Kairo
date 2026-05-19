# Launch tweet variants

## Primary thread (5 tweets)

**1/**
Introducing Kairo — the **Aerodrome Safe LP Agent** on Base.

You install one agent. You set a leash. Kairo enforces it on every action.

Your agent acts. Kairo decides.

🧵👇
[ATTACH: 30s clip of the Policy editor + Receipts feed]

---

**2/**
The pattern: every action your agent proposes is

→ **simulated** against live chain state
→ **evaluated** against the policy you signed
→ **auto-approved**, queued for you, or denied

And every decision lands as a public, shareable receipt.

[ATTACH: a receipt page screenshot]

---

**3/**
What makes it Aerodrome-native:

Policy primitives that actually mean something for LPs:

• min APR delta for auto-rebalance
• max impermanent loss tolerance
• pool allowlist
• gauge allowlist
• auto-claim threshold

Not just "max $5/day."

---

**4/**
Why it's not just a server:

`KairoPolicy.sol` lives on Base.
Your leash is immutable on-chain.
The agent reads from the contract as the source of truth.

If our server cheats, you can verify on Basescan.

[ATTACH: a Basescan link to KairoPolicy.sol]

---

**5/**
Built on Base. Native to @aerodromefi. Aligned with @aomi_labs's simulation
runtime. Every action gets a receipt; every receipt is a shareable URL.

Live demo → kairo.dev
Code → github.com/[org]/kairo
Built for @DecentralDev_ × @base Early Forge

cc @aomi_labs @aerodromefi @base

---

## Standalone tweet (single)

Your AI agent shouldn't have your private key. Your AI agent shouldn't need
to ping you every 5 minutes either.

Kairo gives Aerodrome LP agents a leash: spend caps, pool allowlists, APR
thresholds — enforced on-chain on Base.

→ kairo.dev

[ATTACH: the receipt page screenshot]

---

## Reply-to-Aomi tweet (for amplification)

@aomi_labs we built Kairo for the Aerodrome track — an LP autopilot that
runs inside a policy you sign and verify on-chain.

Steward reads gauge weights, proposes rebalances, every action goes through
your leash before it touches your wallet.

Demo: kairo.dev
