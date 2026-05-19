# Kairo — Brand

## Name

**Kairo.** /KAI-roh/. Two syllables. Short, soft, Aomi-adjacent.

Etymology cover story (for the about page): from the Japanese *kairo* (回路) — circuit, the path a signal travels. Kairo is the circuit between agent intent and human consent.

## One-liners

Use in order of decreasing formality.

- **Tagline:** Your agent acts. Kairo decides.
- **Subhead:** Consent and policy for autonomous crypto on Base.
- **Elevator:** Kairo lets you set what your agent can do on Base — and gets your blessing for everything else, in Telegram, in seconds.
- **Casual:** An agent leash that does not feel like one.

Never say:
- "Firewall" — too security-tool, too defensive
- "Guardrails" — overused, weak
- "Wallet protector" — Kairo is not a wallet product
- "Permissions manager" — sounds like an enterprise IT tool

## Voice

Three rules.

1. **Talk like Mei talks.** Not like a protocol whitepaper. Not like a security vendor. Like a product designer who reads The Browser Company's blog.
2. **Show, don't enumerate.** Show one receipt, not a list of features. Show one Telegram approval, not a policy taxonomy.
3. **Confidence without bravado.** "Kairo decides" — not "Kairo intelligently evaluates a multi-factor risk vector."

## Visual direction

**Mood:** Calm, deliberate, modern. The aesthetic of a tool that says *no* to your agent on your behalf without making a fuss.

References:
- Linear's empty states
- Vercel's receipts
- Arc's permission prompts
- Polymarket's clean tabular UI

**Color system** (placeholder, finalize when design pass begins):

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B0B0E` | App background (dark) |
| `--surface` | `#16161B` | Cards |
| `--surface-2` | `#1F1F26` | Elevated cards, inputs |
| `--text` | `#EDEDF0` | Primary text |
| `--text-dim` | `#8A8A95` | Secondary text |
| `--accent` | `#7FE3C4` | Primary action, approve state. Soft mint, not crypto-green. |
| `--warn` | `#F5C26B` | "Needs approval" state. Warm amber, not alarm. |
| `--deny` | `#F08080` | Denied/blocked state. Muted coral, not red. |
| `--line` | `#26262E` | Borders, dividers |

Light mode exists but is secondary. Dark first because the Aomi/Base ecosystem skews dark and because the receipt pages photograph better.

**Typography:**
- Display + body: **Inter** (or **Geist** if Vercel keeps shipping it)
- Numbers, addresses, hashes: **JetBrains Mono** at slightly tightened tracking

**Logo direction** (brief for designer / Midjourney):
- Wordmark "kairo" in lowercase, custom-cut Inter or Geist with a tiny modification to the *k* — a circuit-trace cut through the diagonal
- Mark for favicons: a single circuit node — a small filled circle with two short lines branching at 120°
- Avoid: shields, locks, padlocks, eyeballs, robot heads, anything "AI"

## Receipt pages — the signature surface

The thing that makes Kairo shareable is the receipt page. Every approval, denial, and auto-allow gets a permalink. The page shows:

- The agent ("Aerodrome Steward")
- The proposed action in human English ("Move $380 from vAMM-USDC/ETH to sAMM-USDC/USDT")
- The simulation result (token deltas, gas, projected APR)
- The policy rule that applied
- The decision (approved by user, auto-allowed, denied)
- The on-chain tx hash if executed
- A clean OG image for sharing on Twitter/Farcaster

Optimize this page for screenshots. It is the demo video's hero shot.

## Anti-patterns

Things we will not do, no matter how tempting:
- Pixel-art / retro fonts. Not Kairo's lane.
- Emoji-heavy UI. One emoji per screen, max.
- "AI sparkles" gradient logo. Lazy.
- Cartoon mascot. We are a tool, not a brand mascot.
- Long marketing pages. The landing is one screen, one screenshot of a receipt, one CTA.

## Domains to register (when name is finalized)

Priority order: `kairo.dev`, `kairo.xyz`, `usekairo.com`, `kairo.app`.

Twitter handle: `@kairo_dev` or `@usekairo`.
