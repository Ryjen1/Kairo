/**
 * Rogue Steward demo — three scripted proposals showing the consent layer
 * in action. Inspired by SentinelPay's "Rogue Agent" demo but for LP
 * rebalancing on Aerodrome.
 *
 * Run against the local dev server:
 *   pnpm dev                  # in one terminal
 *   pnpm seed:demo 0xYourWallet
 *   pnpm tsx scripts/rogue-steward.ts 0xYourWallet
 *
 * Or for the video, against the deployed URL:
 *   KAIRO_API_URL=https://kairo.dev pnpm tsx scripts/rogue-steward.ts 0xMei
 *
 * What it does:
 *   Scenario A — within policy → AUTO-APPROVED
 *   Scenario B — over per-action cap → REQUIRES USER APPROVAL
 *   Scenario C — pool not on allowlist → DENIED
 *
 * Between scenarios it pauses so the demo recorder can pan to the receipts
 * feed and the public receipt page.
 */

const DEFAULT_WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f0beB1";
const WALLET = (process.argv[2] ?? DEFAULT_WALLET).trim();

if (!/^0x[a-fA-F0-9]{40}$/.test(WALLET)) {
  console.error("Usage: tsx scripts/rogue-steward.ts 0x<wallet>");
  process.exit(1);
}

const API = process.env.KAIRO_API_URL ?? "http://localhost:3000";
const PAUSE_BETWEEN_MS = Number(process.env.ROGUE_PAUSE_MS ?? 6_000);

const POOL_WETH_USDC = "0xcDAC0d6c6C59727a65F871236188350531885C43";
const POOL_USDC_USDBC = "0x4D69971CCd4A636c403a3C1B00c85e99bB9B5606";
const POOL_NOT_ALLOWLISTED = "0x1111111111111111111111111111111111111111";

/**
 * For scenario C we tighten the policy to an allowlist of two pools. This
 * makes the demo deterministic regardless of where the wallet's actual
 * positions are.
 */
async function tightenPolicyForScenarioC() {
  const policyUrl = `${API}/api/policies/${WALLET}/steward`;
  const current = await fetch(policyUrl).then((r) => r.json());
  const tightened = {
    ...current,
    rules: {
      ...current.rules,
      poolAllowlist: [POOL_WETH_USDC, POOL_USDC_USDBC],
    },
  };
  const res = await fetch(policyUrl, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(tightened),
  });
  if (!res.ok) {
    console.error(`  ✗ failed to tighten policy: ${await res.text()}`);
  }
}

async function relaxPolicy() {
  const policyUrl = `${API}/api/policies/${WALLET}/steward`;
  const current = await fetch(policyUrl).then((r) => r.json());
  const relaxed = {
    ...current,
    rules: { ...current.rules, poolAllowlist: [] },
  };
  await fetch(policyUrl, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(relaxed),
  });
}

async function submit(label: string, body: Record<string, unknown>) {
  console.log(`\n──── ${label} ────`);
  const res = await fetch(`${API}/api/proposals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    receipt?: { hash: string; status: string; decision?: { reason: string } };
    url?: string;
    error?: string;
  };
  if (!res.ok || !json.receipt) {
    console.error(`  ✗ ${res.status} ${json.error ?? "unknown"}`);
    return;
  }
  console.log(`  status:  ${json.receipt.status}`);
  console.log(`  reason:  ${json.receipt.decision?.reason ?? ""}`);
  console.log(`  receipt: ${json.url}`);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureSteward() {
  await fetch(`${API}/api/wallets/${WALLET}/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agentId: "steward", action: "install" }),
  });
}

async function run() {
  console.log(`Rogue Steward demo against ${API}`);
  console.log(`Wallet: ${WALLET}\n`);

  await ensureSteward();
  // Reset to defaults (no allowlist, $250 per-action cap from defaults).
  await relaxPolicy();

  // ── Scenario A ─────────────────────────────────────────────────────────
  await submit("Scenario A · within policy", {
    id: `rogue-A-${Date.now()}`,
    kind: "rebalance",
    agentId: "steward",
    wallet: WALLET,
    createdAt: Date.now(),
    summary:
      "Move $200 from vAMM-WETH/USDC to sAMM-USDC/USDbC (+5.2% APR)",
    simulation: {
      success: true,
      gasUsed: "220000",
      tokenDeltas: [],
      blockNumber: "46120400",
    },
    fromPool: POOL_WETH_USDC,
    toPool: POOL_USDC_USDBC,
    amountUsd: 200,
    projectedAprDeltaBps: 520,
    projectedImpermanentLossBps: 80,
  });
  await sleep(PAUSE_BETWEEN_MS);

  // ── Scenario B ─────────────────────────────────────────────────────────
  await submit("Scenario B · over per-action cap", {
    id: `rogue-B-${Date.now()}`,
    kind: "rebalance",
    agentId: "steward",
    wallet: WALLET,
    createdAt: Date.now(),
    summary:
      "Move $1,500 from vAMM-WETH/USDC to sAMM-USDC/USDbC (+6.4% APR)",
    simulation: {
      success: true,
      gasUsed: "220000",
      tokenDeltas: [],
      blockNumber: "46120401",
    },
    fromPool: POOL_WETH_USDC,
    toPool: POOL_USDC_USDBC,
    amountUsd: 1500,
    projectedAprDeltaBps: 640,
    projectedImpermanentLossBps: 100,
  });
  await sleep(PAUSE_BETWEEN_MS);

  // ── Scenario C ─────────────────────────────────────────────────────────
  await tightenPolicyForScenarioC();
  await submit("Scenario C · pool not on allowlist", {
    id: `rogue-C-${Date.now()}`,
    kind: "add_liquidity",
    agentId: "steward",
    wallet: WALLET,
    createdAt: Date.now(),
    summary: "Add $150 liquidity to an unknown pool",
    simulation: {
      success: true,
      gasUsed: "180000",
      tokenDeltas: [],
      blockNumber: "46120402",
    },
    pool: POOL_NOT_ALLOWLISTED,
    tokenA: "0x4200000000000000000000000000000000000006",
    tokenB: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    amountUsd: 150,
  });
  await relaxPolicy();

  console.log("\n✓ Rogue Steward run complete.");
  console.log("  Visit /app/receipts to see the timeline.");
  console.log("  Each receipt links to its public /r/<hash> page for sharing.");
}

run().catch((err) => {
  console.error("rogue-steward crashed:", err);
  process.exit(1);
});
