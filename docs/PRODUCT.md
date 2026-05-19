# Kairo — Product Spec

> Your agent acts. Kairo decides.

## What it is

Kairo is the **Aerodrome Safe LP Agent** — a consent and policy layer for autonomous LP management on Base. Users install the **Aerodrome Steward** agent, set a leash in plain English, and Kairo enforces it at the moment of action.

Every proposed action is simulated against live chain state, evaluated against the user's policy (which lives on-chain in `KairoPolicy.sol` for verifiability), and either auto-approved, queued for approval in Telegram, or blocked. Every decision is recorded as a public, shareable receipt.

Kairo is purpose-built for Base. The policy engine is Aerodrome-aware (APR delta thresholds, impermanent loss tolerance, pool and gauge allowlists, auto-claim caps), the source of truth lives on-chain in `KairoPolicy.sol`, and every action is forked-simulated against Base mainnet before the user is asked.

## Why now

Agentic crypto is shipping. Aomi, Olas, and the agent kits make it trivial to spin up an autonomous wallet operator. What is missing is the layer between "I trust this agent broadly" and "I trust this agent with $5,000 right now." Without that layer users have two options: do nothing, or hand over the keys. Kairo is the third option.

## Persona

**Mei. 29. Product designer. Based in Singapore.**

She bought ETH in 2021, swapped to USDC in 2023, and started LPing on Aerodrome in early 2026 because a friend showed her the yields. She has roughly $5,000 spread across 2–3 pools. She speaks fluent crypto-curious — she knows what a gauge is, she does not know what an MEV searcher is, and she does not want to.

**What she wants:**
- More yield than parking USDC
- Less attention required than checking gauge weights on Sunday nights
- Confidence that a bad week of gas prices or a depegged stable will not eat her position while she sleeps

**What she has tried:**
- Manual rebalancing. Works, but she forgets for weeks at a time.
- Following Crypto Twitter accounts for LP signals. Information is late.
- Looking at agent products. Bounces off the "approve unlimited spend" wall every time.

**What Kairo gives her:**
> "Aerodrome Steward, you can rebalance up to $500 per move. Only between vAMM-USDC/ETH, sAMM-USDC/USDT, and the cbETH/ETH gauge. Only if projected APR delta is above 4%. Anything else, ping me on Telegram. Claim rewards every Sunday."

She gets the yield, she gets the leash, she gets to sleep.

## Scope (v1, by May 30)

In:
- Aerodrome plugin (5 tools): `get_positions`, `quote_swap`, `simulate_rebalance`, `claim_rewards`, `vote_for_gauge`
- Policy engine with LP-aware primitives (spend cap, pool allowlist, min APR delta, claim schedule, max impermanent loss tolerance)
- Telegram bot via Aomi's hosted runtime
- PWA at `app.kairo.dev`: positions overview, policy editor, receipt timeline
- Public receipt pages at `kairo.dev/r/<receipt-hash>` — shareable, embeddable
- One demo agent: "Aerodrome Steward" running on a 6-hour schedule

Out (v2 and later):
- Multi-protocol policies (Zora, Limitless, Avantis)
- iOS native app
- On-chain receipt anchoring (EAS attestations)
- Team / shared-policy mode
- Browser extension surface

## Success criteria

A submission is "great" if:

1. A real or staged Mei can complete the end-to-end flow in under 5 minutes on her phone: connect wallet, install Steward agent, set a policy, receive a real Telegram approval request, approve, see the receipt.
2. The agent makes at least one autonomous-but-policy-gated decision in the demo video that the user does not have to approve, demonstrating the productivity loop.
3. The receipts page is good enough that the user wants to share it.
4. The Aerodrome team would reasonably retweet the launch.

## Anti-goals

- Do not build a generic agent runtime. Aomi is that.
- Do not build a wallet. Para is that.
- Do not build cross-chain. Base only.
- Do not build mainnet from day one. Base Sepolia for demo, mainnet flag-gated.
- Do not let policy editing become a programming exercise. Three modes (Ask, Allow under limits, Block) plus 5 sliders. That is the entire UI.

## Differentiation

Things that already exist in the space:
- Generic "approve every transaction" wallet flows. Too noisy.
- Agent kits that take full custody. Too risky.
- Multisig / Safe modules. Too heavy for retail.

What Kairo adds:
- **Protocol-aware policy primitives.** A spend cap is generic. "Max IL tolerance" only makes sense if the policy engine knows the user is LPing.
- **Simulation-first decisions.** Every policy evaluation runs against an Anvil fork via Aomi's runtime. Mei sees the projected outcome before she decides.
- **Shareable receipts.** The audit trail is a product surface, not a debugging tool.
- **Telegram-native.** The decision happens where the user already lives.

## Demo script (90 seconds)

1. Mei opens the PWA, connects her wallet, sees her two Aerodrome positions.
2. She installs the Steward agent in one tap. Default policy is pre-filled with sane bounds.
3. She tweaks one slider: max spend per move from $250 to $500.
4. Cut to her Telegram. The bot pings: "Steward wants to move $380 from vAMM-USDC/ETH to sAMM-USDC/USDT. Projected APR delta: +5.2%. Simulated outcome: +$0.34/day. Approve / Deny / Edit policy."
5. She taps Approve. The bot confirms execution and posts the receipt link.
6. She opens the receipt page. Clean, public, shareable. She tweets it.
7. Card: "Your agent acts. Kairo decides. kairo.dev"
