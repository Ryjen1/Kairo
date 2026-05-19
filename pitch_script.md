# Kairo — Pitch Script

**90 seconds. Spoken over a screen recording.**

---

### 0:00 — 0:08 · The problem

> "AI agents are about to manage real money on-chain. Today you have two
> options: give the agent your private key — and pray — or approve every
> transaction yourself — and never sleep."

*(cut from a chat UI to a wallet pop-up to a tired person at a laptop)*

### 0:08 — 0:18 · The pitch

> "Kairo is the Aerodrome Safe LP Agent. You install one agent — Aerodrome
> Steward — set a policy in plain English, and it manages your liquidity
> positions inside the leash you defined."

*(cut to the Kairo landing page, then to the Policy editor with sliders)*

### 0:18 — 0:35 · Scenario A — auto-approved

> "Here Steward sees a 5.2% APR uplift, proposes moving $200, and Kairo
> auto-approves because it's inside the policy. Receipt logged."

*(run `pnpm rogue 0xMei`. Scenario A fires. Cut to /app/receipts. Click the
new receipt. Pan over the public /r/<hash> page.)*

### 0:35 — 0:55 · Scenario B — requires you

> "Now Steward wants to move $1,500. Over the per-action cap. Kairo doesn't
> auto-execute — it routes the proposal to the user with the exact reason
> attached. In production this is a Telegram ping. Mei approves or denies
> from her phone."

*(Scenario B fires. Show the 'Pending you' badge. Click into the receipt
page, show the reason text.)*

### 0:55 — 1:15 · Scenario C — denied

> "And here Steward goes rogue — tries to add liquidity to a pool that's
> not on the allowlist. Kairo blocks it at the policy layer. The receipt
> records the rejected attempt with the exact rule that triggered."

*(Scenario C fires. Show the 'Blocked' badge.)*

### 1:15 — 1:25 · Why it's verifiable

> "The policy isn't just a server-side rule. It lives in `KairoPolicy.sol`
> on Base. Anyone can verify Mei's leash on-chain — including the agent
> itself, which reads from the contract as its source of truth."

*(cut to a basescan link, then back to the Policy page with the 'Verified
on-chain' badge)*

### 1:25 — 1:30 · Close

> "Aerodrome's biggest LPs are still managing positions by hand on Sundays.
> Kairo gives them an agent they can actually trust. Non-custodial,
> simulation-first, verifiable on Base. Live now."

*(end card with the Kairo wordmark + URL)*

---

## Cuts that don't make the 90 seconds (B-roll)

- The `pnpm contracts:test` output rolling past with 17 green tests
- A wagmi wallet connect modal
- The receipt OG image at Twitter share-card size
- The Positions page showing a real wallet with two Aerodrome positions
- A scroll through the policy slider UI with the values updating in real time
