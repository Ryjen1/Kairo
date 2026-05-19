import { NextResponse } from "next/server";
import { getReceipt } from "@/lib/storage";

interface Params {
  params: Promise<{ hash: string }>;
}

export async function GET(_req: Request, ctx: Params) {
  const { hash } = await ctx.params;
  const receipt = await getReceipt(hash);
  if (!receipt) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(receipt);
}
