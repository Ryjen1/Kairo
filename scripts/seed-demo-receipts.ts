/**
 * Pre-seed the local SQLite DB with three demo receipts so the click-through
 * shows a realistic timeline. Mirrors the "Rogue Steward" three-scenario
 * demo we use in the launch video.
 *
 * Usage: pnpm seed:demo -- 0xYourWalletAddress
 */
const DEFAULT_WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f0beB1";

const WALLET = (process.argv[2] ?? DEFAULT_WALLET).trim();
if (!/^0x[a-fA-F0-9]{40}$/.test(WALLET)) {
  console.error("Usage: tsx scripts/seed-demo-receipts.ts 0x<wallet>");
  process.exit(1);
}

const API = process.env.KAIRO_API_URL ?? "http://localhost:3000";

const POOL_WETH_USDC = "0xcDAC0d6c6C59727a65F871236188350531885C43";
const POOL_USDC_USDBC = "0x4D69971CCd4A636c403a3C1B00c85e99bB9B5606";
const POOL_NOT_ALLOWLISTED = "0x9999999999999999999999999999999999999999";

const scenarios = [
  {
    label: "A · Auto-approved (within policy)",
    body: {
      id: `demo-auto-${Date.now()}`,
      kind: "rebalance",
      agentId: "steward",
      wallet: WALLET,
      createdAt: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
      summary: "Move $200 from vAMM-WETH/USDC to sAMM-USDC/USDbC",
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
    },
  },
  {
    label: "B · Requires user approval (over cap)",
    body: {
      id: `demo-pending-${Date.now()}`,
      kind: "rebalance",
      agentId: "steward",
      wallet: WALLET,
      createdAt: Date.now() - 1000 * 60 * 25, // 25 minutes ago
      summary: "Move $1,500 from vAMM-WETH/USDC to sAMM-USDC/USDbC",
      simulation: {
        success: true,
        gasUsed: "220000",
        tokenDeltas: [],
        blockNumber: "46120401",
      },
      fromPool: POOL_WETH_USDC,
      toPool: POOL_USDC_USDBC,
      amountUsd: 1500,
      projectedAprDeltaBps: 620,
      projectedImpermanentLossBps: 100,
    },
  },
  {
    label: "C · Auto-claim (small reward, under threshold)",
    body: {
      id: `demo-claim-${Date.now()}`,
      kind: "claim_rewards",
      agentId: "steward",
      wallet: WALLET,
      createdAt: Date.now() - 1000 * 60 * 8, // 8 minutes ago
      summary: "Claim 14.2 AERO from vAMM-WETH/USDC gauge",
      simulation: {
        success: true,
        gasUsed: "120000",
        tokenDeltas: [],
        blockNumber: "46120402",
      },
      pool: POOL_WETH_USDC,
      estimatedRewardUsd: 12.07,
    },
  },
];

async function seed() {
  // Make sure Steward is installed for this wallet.
  console.log(`→ Installing Steward for ${WALLET}`);
  const installRes = await fetch(`${API}/api/wallets/${WALLET}/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agentId: "steward", action: "install" }),
  });
  if (!installRes.ok) {
    console.error("  install failed:", installRes.status, await installRes.text());
    process.exit(1);
  }
  console.log(`  ✓ installed`);

  for (const s of scenarios) {
    console.log(`\n→ ${s.label}`);
    const res = await fetch(`${API}/api/proposals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(s.body),
    });
    if (!res.ok) {
      console.error(`  ✗ ${res.status} ${await res.text()}`);
      continue;
    }
    const body = (await res.json()) as {
      receipt: { hash: string; status: string };
      url: string;
    };
    console.log(`  status: ${body.receipt.status}`);
    console.log(`  url:    ${body.url}`);
  }

  console.log("\n✓ Demo receipts seeded. Visit /app/receipts in the connected wallet.");
}

seed().catch((err) => {
  console.error("seed crashed:", err);
  process.exit(1);
});
