import { NextResponse } from "next/server";
import type { Address } from "viem";
import {
  installAgent,
  listInstalledAgents,
  uninstallAgent,
} from "@/lib/storage";

interface Params {
  params: Promise<{ wallet: string }>;
}

export async function GET(_req: Request, ctx: Params) {
  const { wallet } = await ctx.params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "invalid wallet" }, { status: 400 });
  }
  const agents = await listInstalledAgents(wallet as Address);
  return NextResponse.json({ agents });
}

export async function POST(req: Request, ctx: Params) {
  const { wallet } = await ctx.params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "invalid wallet" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    agentId?: string;
    action?: "install" | "uninstall";
  };
  if (!body.agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 });
  }
  if (body.action === "uninstall") {
    await uninstallAgent(wallet as Address, body.agentId);
  } else {
    await installAgent(wallet as Address, body.agentId);
  }
  return NextResponse.json({ ok: true });
}
