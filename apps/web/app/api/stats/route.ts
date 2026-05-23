import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * `GET /api/stats` — aggregate receipt counts for the demo telemetry strip.
 *
 * Polled every 10s by the /demo page. Real DB rows, real counts. Returns
 * zero across the board until the first scenario fires.
 */
export async function GET() {
  const [totalReceipts, autoApproved, pending, denied, lastReceipt] =
    await Promise.all([
      prisma.receipt.count(),
      prisma.receipt.count({ where: { status: "auto_approved" } }),
      prisma.receipt.count({ where: { status: "pending_user" } }),
      prisma.receipt.count({
        where: { status: { in: ["denied_by_policy", "denied_by_user"] } },
      }),
      prisma.receipt.findFirst({
        orderBy: { finalizedAt: "desc" },
        select: { finalizedAt: true },
      }),
    ]);

  return NextResponse.json({
    totalReceipts,
    autoApproved,
    pending,
    denied,
    lastReceiptAt: lastReceipt?.finalizedAt.getTime() ?? null,
    updatedAt: Date.now(),
  });
}
