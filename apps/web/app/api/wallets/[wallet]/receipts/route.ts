import { NextResponse } from "next/server";
import type { Address } from "viem";
import { listReceiptsForWallet } from "@/lib/storage";

interface Params {
  params: Promise<{ wallet: string }>;
}

export async function GET(req: Request, ctx: Params) {
  const { wallet } = await ctx.params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "invalid wallet" }, { status: 400 });
  }
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit");
  const cursor = url.searchParams.get("cursor");
  const result = await listReceiptsForWallet(wallet as Address, {
    limit: limit ? Number(limit) : undefined,
    cursor: cursor ?? undefined,
  });
  return NextResponse.json(result);
}
