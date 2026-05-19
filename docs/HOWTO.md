# How to use Kairo

A 5-minute walkthrough for **Mei** — our archetype user. Mei is a part-time Aerodrome LP with ~$5k across 2-3 pools. She wants yield without checking gauges every Sunday.

If you're a judge: run this on a wallet that holds at least one Aerodrome LP position. If you don't have one, see [Demo mode](#demo-mode) at the end — you can run the whole flow without real positions.

## 1. Connect your wallet

1. Visit [kairo.dev](https://kairo.dev) (or `http://localhost:3000` if running locally)
2. Click **Open dashboard**
3. Connect a wagmi-compatible wallet (MetaMask, Rabby, Coinbase Wallet, Phantom EVM)
4. Approve the connection request — Kairo asks for **nothing custodial**, only a read connection

You're now in. Kairo never touches your private key.

## 2. See your Aerodrome positions

Go to **Positions** (the default landing tab inside the app).

You'll see a card per LP position with:
- Pool symbol, stable/volatile badge
- Live USD value, % share of pool
- LP tokens held in wallet vs staked in gauge
- AERO rewards earned (claimable)
- Gauge contract address

Data is read live from Base mainnet. If you hold positions outside the six major pairs Kairo currently scans, they won't appear in v1 — expansion ships next week.

## 3. Install Aerodrome Steward

Go to **Agents**.

Tap **Install** on the *Aerodrome Steward* card.

What just happened:
- Kairo created a default policy for the pair `(your wallet, steward)`
- The policy lives off-chain by default; if you've set `NEXT_PUBLIC_KAIRO_POLICY_ADDRESS` it also mirrors to Base Sepolia
- Steward is now registered — but it can't do anything yet, you haven't given it a leash

## 4. Set the leash

Go to **Policy**.

Three big buttons at the top:

| Mode | What it does |
|---|---|
| **Ask every time** | Steward must ping you for every action. Loudest. |
| **Allow under limits** | Auto-approve actions inside your rules. Ping you for the rest. **Default.** |
| **Block** | Steward is paused. Nothing executes. |

Below, five sliders (active in *Allow under limits* mode):

| Slider | Default | What it does |
|---|---|---|
| Max spend per action | $250 | Single-action ceiling. Anything bigger requires your approval. |
| Daily cap | $1,000 | Rolling 24h spend total. After this, everything pings you. |
| Min APR delta for auto-rebalance | 4% | Steward needs at least this APR uplift to rebalance without asking. |
| Max impermanent loss tolerance | 2% | Refuse rebalances projected to incur more IL than this. |
| Auto-claim rewards up to | $50 | Reward claims under this USD value auto-approve. |

Move sliders. Tap **Save policy**. Done.

If you have on-chain enforcement enabled, the same button signs a tx to `KairoPolicy.setPolicy(...)` on Base Sepolia and the **Verified on-chain** badge appears above the editor.

## 5. Run the Steward agent (or use Rogue Steward)

Two options:

### Option A · Real Steward, real signals

In your terminal:

```bash
STEWARD_WALLET=0xYourWallet pnpm steward
```

Steward starts ticking every 60 seconds. Each tick:

1. Reads your positions from Base mainnet
2. Reads live gauge weights and reward rates from `Voter.sol`
3. Estimates APR for each candidate pool
4. If the best-vs-worst delta in your positions exceeds your threshold, proposes a rebalance
5. If you have ≥1 AERO claimable in a gauge, proposes a claim
6. POSTs each proposal to Kairo's API

Kairo evaluates each proposal against your policy and either auto-executes (logs an auto-approved receipt), files as pending-user (logs a pending receipt + would Telegram-ping you in v2), or denies (logs a blocked receipt with the rule that triggered).

### Option B · Rogue Steward, three scripted scenarios

For the demo video or a fast walkthrough:

```bash
pnpm rogue 0xYourWallet
```

This fires three proposals in sequence:

1. **Within policy** — $200 rebalance with +5.2% APR delta. Auto-approves.
2. **Over per-action cap** — $1,500 rebalance. Routes to user.
3. **Pool not on allowlist** — $150 add-liquidity to an unknown pool. Denied.

There's a 6-second pause between scenarios so you can watch the timeline fill up.

## 6. Read the receipts

Go to **Receipts**.

You'll see a reverse-chronological feed. Each row shows:
- Status badge (auto-approved, pending you, blocked, etc)
- Time ago
- Action summary
- Truncated receipt hash + agent id

Click any row → public receipt page at `/r/<hash>` with:
- Full proposal details (which pools, what amount, what APR delta)
- Simulation result (gas, projected token deltas)
- The decision and the reason
- Every policy rule that was evaluated and whether it passed
- On-chain tx hash if executed

Each receipt page has a shareable OG image — it screenshots well for Twitter.

## 7. (Optional) Pin the on-chain policy

If you want the receipt to say **Verified on-chain**:

```bash
# Deploy KairoPolicy.sol once
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast --verify

# Then set the env var
echo "NEXT_PUBLIC_KAIRO_POLICY_ADDRESS=0xYourDeployed" >> apps/web/.env
pnpm dev
```

The Policy page now shows the on-chain badge with a basescan link.

## Demo mode

You don't need real Aerodrome positions to evaluate Kairo. The Rogue Steward script works against any wallet address — it sends synthetic proposals that exercise the full policy + receipt pipeline. The receipts are real (signed, hashed, stored, shareable); only the underlying agent activity is staged.

For judges:

```bash
git clone https://github.com/[org]/kairo
cd kairo
pnpm install
pnpm --filter web exec prisma db push
pnpm dev                       # terminal 1
pnpm rogue 0xDemoWallet        # terminal 2
```

Visit `http://localhost:3000/app/receipts` to see three receipts. Click each one for the public receipt page.

## What's deferred to week 2

- Telegram approval pings (today: in-app pending state)
- Live on-chain execution (today: receipts mark as executed but we don't broadcast)
- ERC-8004 agent identity registration
- MCP server for any-agent integration
- Aomi-hosted runtime swap (today: local Node cron)
