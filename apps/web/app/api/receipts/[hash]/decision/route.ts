import { NextResponse } from "next/server";
import { z } from "zod";
import { getReceipt, updateReceiptStatus } from "@/lib/storage";

const BodySchema = z.object({
  decision: z.enum(["approve", "deny"]),
});

interface Params {
  params: Promise<{ hash: string }>;
}

export async function POST(req: Request, ctx: Params) {
  const { hash } = await ctx.params;

  const existing = await getReceipt(hash);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.status !== "pending_user") {
    return NextResponse.json(
      { error: `receipt not pending (status: ${existing.status})` },
      { status: 409 },
    );
  }

  let body: { decision: "approve" | "deny" };
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: `invalid body: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const newStatus =
    body.decision === "approve" ? "approved_by_user" : "denied_by_user";

  const updated = await updateReceiptStatus(hash, newStatus, "user");
  if (!updated) {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  return NextResponse.json(updated);
}
