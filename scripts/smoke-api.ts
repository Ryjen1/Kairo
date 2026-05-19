/**
 * End-to-end smoke test for the Kairo HTTP API.
 *
 * Prereq: dev server running on $KAIRO_API_URL (default http://localhost:3000).
 *
 * Runs through the full policy → proposal → receipt lifecycle for a
 * synthetic wallet, exercising:
 *  - default policy creation
 *  - policy update (tighten cap)
 *  - auto-approve path (proposal within cap)
 *  - requires-approval path (proposal over cap)
 *  - user-decision endpoint (approve a pending receipt)
 *  - receipts listing
 *  - public receipt fetch
 *
 * Usage: pnpm tsx scripts/smoke-api.ts
 */

const API = process.env.KAIRO_API_URL ?? "http://localhost:3000";
const WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f0beB1";
const AGENT = "steward-smoke";

let failures = 0;

function expect(cond: boolean, label: string, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failures++;
  }
}

async function http(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${API}${path}`, init);
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, body };
}

async function main() {
  console.log(`→ Kairo API smoke @ ${API}`);
  console.log(`  wallet ${WALLET} · agent ${AGENT}\n`);

  // 1. Default policy fetch (creates if missing).
  console.log("1. Default policy");
  let res = await http(`/api/policies/${WALLET}/${AGENT}`);
  expect(res.status === 200, "200 OK");
  expect(res.body.mode === "allow_under_limits", "default mode allow_under_limits");
  expect(
    res.body.rules?.maxSpendPerActionUsd === 250,
    "default per-action cap $250",
  );

  // 2. Tighten the cap to $100.
  console.log("\n2. Update policy");
  const tightened = {
    ...res.body,
    rules: { ...res.body.rules, maxSpendPerActionUsd: 100 },
  };
  res = await http(`/api/policies/${WALLET}/${AGENT}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(tightened),
  });
  expect(res.status === 200, "200 OK");
  expect(
    res.body.rules.maxSpendPerActionUsd === 100,
    "per-action cap is now $100",
  );

  // 3. Submit a small proposal — should auto-approve.
  console.log("\n3. Auto-approve path ($50 swap)");
  const swap = {
    id: `smoke-swap-${Date.now()}`,
    kind: "swap",
    agentId: AGENT,
    wallet: WALLET,
    createdAt: Date.now(),
    summary: "Swap $50 USDC for WETH",
    simulation: {
      success: true,
      gasUsed: "200000",
      tokenDeltas: [],
      blockNumber: "46120400",
    },
    tokenIn: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    tokenOut: "0x4200000000000000000000000000000000000006",
    amountInUsd: 50,
    expectedAmountOutUsd: 49.5,
    slippageBps: 50,
  };
  res = await http(`/api/proposals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(swap),
  });
  expect(res.status === 200, "200 OK");
  expect(res.body.executed === true, "executed = true");
  expect(
    res.body.receipt.status === "auto_approved",
    "receipt status auto_approved",
  );
  const autoHash = res.body.receipt.hash;

  // 4. Submit a big one — should require approval.
  console.log("\n4. Requires-approval path ($500 swap > $100 cap)");
  const big = { ...swap, id: `smoke-big-${Date.now()}`, amountInUsd: 500 };
  res = await http(`/api/proposals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(big),
  });
  expect(res.status === 200, "200 OK");
  expect(res.body.executed === false, "executed = false");
  expect(
    res.body.receipt.status === "pending_user",
    "receipt status pending_user",
  );
  expect(
    String(res.body.receipt.decision.reason).includes("cap"),
    "reason mentions cap",
  );
  const pendingHash = res.body.receipt.hash;

  // 5. Approve the pending receipt as the user.
  console.log("\n5. User approves pending receipt");
  res = await http(`/api/receipts/${pendingHash}/decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision: "approve" }),
  });
  expect(res.status === 200, "200 OK");
  expect(
    res.body.status === "approved_by_user",
    "status moved to approved_by_user",
  );
  expect(res.body.decisionActor === "user", "decisionActor = user");

  // 6. Cannot decide on the same receipt twice.
  console.log("\n6. Double-decision is rejected");
  res = await http(`/api/receipts/${pendingHash}/decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision: "deny" }),
  });
  expect(res.status === 409, "409 Conflict");

  // 7. List receipts for the wallet.
  console.log("\n7. List receipts");
  res = await http(`/api/wallets/${WALLET}/receipts?limit=10`);
  expect(res.status === 200, "200 OK");
  expect(Array.isArray(res.body.receipts), "receipts is an array");
  expect(
    res.body.receipts.some((r: any) => r.hash === autoHash),
    "list contains auto-approved receipt",
  );
  expect(
    res.body.receipts.some((r: any) => r.hash === pendingHash),
    "list contains user-approved receipt",
  );

  // 8. Public receipt fetch.
  console.log("\n8. Public receipt fetch");
  res = await http(`/api/receipts/${autoHash}`);
  expect(res.status === 200, "200 OK");
  expect(res.body.hash === autoHash, "hash matches");

  // 9. Block mode denies everything.
  console.log("\n9. Block mode denies");
  await http(`/api/policies/${WALLET}/${AGENT}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...tightened, mode: "block" }),
  });
  res = await http(`/api/proposals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...swap, id: `smoke-block-${Date.now()}` }),
  });
  expect(
    res.body.receipt.status === "denied_by_policy",
    "denied_by_policy when mode=block",
  );
  expect(res.body.executed === false, "not executed when blocked");

  console.log(`\n${failures === 0 ? "✓" : "✗"} ${failures} failures`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error("smoke crashed:", err);
  process.exit(1);
});
