# Kairo Contracts

On-chain enforcement layer for Kairo. Stores immutable per-(wallet, agent) policies that the off-chain engine reads as the source of truth.

## What's in here

- **`KairoPolicy.sol`** — the policy registry. Wallets call `setPolicy` to bind an agent. `getPolicy` and `isActive` are the read surface for the web app and the agent SDK.

## Quick start

Tests run against an in-memory EVM with no external dependencies:

```bash
forge build
forge test -vv
```

16 tests cover: set, revoke, reinstate, expiration, isolation between wallets, daily-cap validation, Aerodrome rule storage, and event emission.

## Deploy to Base Sepolia

```bash
cd contracts
cp ../.env.example ./.env   # set PRIVATE_KEY, BASE_SEPOLIA_RPC, BASESCAN_API_KEY

forge script script/Deploy.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

Pin the deployed address in `apps/web/lib/contracts.ts` and `agents/steward/.env`.

## Why on-chain?

Three reasons:

1. **Immutable rules.** A compromised off-chain server can't change the leash. The user's policy is signed by their wallet and stored in `KairoPolicy.sol`. The off-chain engine reads from here; if it cheats, anyone can verify by reading the chain.
2. **Discoverable.** Any tool — an indexer, a competing UI, a different agent — can read the same source of truth without needing access to Kairo's database.
3. **Auditable.** Every policy change emits an event. The full history of every wallet's agent leash is publicly verifiable forever.

## What's *not* in here (yet)

The contract does not custody funds. Kairo is non-custodial. The user's wallet still signs every action. The contract is a registry of intent; the off-chain engine and the user's wallet do the rest.

Future versions may add:
- `KairoAttestation.sol` — public on-chain receipts via EAS
- ERC-8004 agent identity registration for Aerodrome Steward
- Per-protocol rule modules (Avantis, Zora, Limitless) appended without breaking existing policies
