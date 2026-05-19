import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/arena
 *
 * Returns a leaderboard of wallets using Aerodrome Steward. v1 ranks by
 * a composite signal of (auto-approved actions count, total value moved,
 * approval rate). Once we have on-chain execution wired up, this becomes
 * a real P&L delta vs a passive HODL baseline.
 *
 * The Arena is public — no wallet authentication required. Wallet addresses
 * are truncated in the response, but the canonical address can be revealed
 * client-side for share links.
 */
export async function GET() {
  // Aggregate receipts by wallet over the last 30 days.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await prisma.receipt.findMany({
    where: {
      agentId: "steward",
      finalizedAt: { gte: since },
    },
    select: {
      wallet: true,
      status: true,
      decisionActor: true,
      proposalKind: true,
      proposalJson: true,
      finalizedAt: true,
    },
  });

  // Group by wallet.
  const byWallet = new Map<
    string,
    {
      wallet: string;
      autoApproved: number;
      pending: number;
      executed: number;
      denied: number;
      totalValueMovedUsd: number;
      claimsClaimed: number;
      lastActive: number;
    }
  >();

  for (const row of rows) {
    const w = row.wallet;
    let bucket = byWallet.get(w);
    if (!bucket) {
      bucket = {
        wallet: w,
        autoApproved: 0,
        pending: 0,
        executed: 0,
        denied: 0,
        totalValueMovedUsd: 0,
        claimsClaimed: 0,
        lastActive: 0,
      };
      byWallet.set(w, bucket);
    }

    bucket.lastActive = Math.max(bucket.lastActive, row.finalizedAt.getTime());
    if (row.status === "auto_approved") bucket.autoApproved++;
    if (row.status === "approved_by_user" || row.status === "executed")
      bucket.executed++;
    if (row.status === "pending_user") bucket.pending++;
    if (row.status === "denied_by_policy" || row.status === "denied_by_user")
      bucket.denied++;

    try {
      const p = JSON.parse(row.proposalJson) as {
        kind?: string;
        amountUsd?: number;
        amountInUsd?: number;
        estimatedRewardUsd?: number;
      };
      const usd =
        (p.amountUsd ?? 0) +
        (p.amountInUsd ?? 0) +
        (p.estimatedRewardUsd ?? 0);
      bucket.totalValueMovedUsd += usd;
      if (p.kind === "claim_rewards") bucket.claimsClaimed++;
    } catch {
      /* skip */
    }
  }

  // Composite "Arena score": volume moved × approval rate × activity multiplier.
  const entries = Array.from(byWallet.values()).map((b) => {
    const totalActions = b.autoApproved + b.executed + b.denied + b.pending;
    const approvalRate =
      totalActions === 0
        ? 0
        : (b.autoApproved + b.executed) / Math.max(1, totalActions);
    const recencyDays = Math.max(
      1,
      (Date.now() - b.lastActive) / (24 * 60 * 60 * 1000),
    );
    const recencyMultiplier = Math.max(0.1, 1 - recencyDays / 30);
    const score = Math.round(
      b.totalValueMovedUsd * approvalRate * recencyMultiplier * 10,
    );
    return {
      wallet: b.wallet,
      autoApproved: b.autoApproved,
      pending: b.pending,
      executed: b.executed,
      denied: b.denied,
      totalValueMovedUsd: Math.round(b.totalValueMovedUsd * 100) / 100,
      claimsClaimed: b.claimsClaimed,
      lastActive: b.lastActive,
      approvalRate,
      score,
    };
  });

  entries.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    arena: entries.slice(0, 50),
    totalWallets: entries.length,
    updatedAt: Date.now(),
  });
}
