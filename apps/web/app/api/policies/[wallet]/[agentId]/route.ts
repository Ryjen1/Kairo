import { NextResponse } from "next/server";
import { z } from "zod";
import type { Address } from "viem";
import type { Policy } from "@kairo/policy";
import { getOrCreatePolicy, upsertPolicy } from "@/lib/storage";

const PolicyRulesSchema = z.object({
  maxSpendPerActionUsd: z.number().nonnegative(),
  dailyCapUsd: z.number().nonnegative(),
  poolAllowlist: z.array(z.string()),
  gaugeAllowlist: z.array(z.string()),
  minAprDeltaBps: z.number().nonnegative(),
  maxImpermanentLossBps: z.number().nonnegative(),
  autoClaimUpToUsd: z.number().nonnegative(),
  requireSuccessfulSimulation: z.boolean(),
});

const PolicySchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  agentId: z.string().min(1),
  updatedAt: z.number().optional(),
  mode: z.enum(["ask_every", "allow_under_limits", "block"]),
  rules: PolicyRulesSchema,
});

interface Params {
  params: Promise<{ wallet: string; agentId: string }>;
}

export async function GET(_req: Request, ctx: Params) {
  const { wallet, agentId } = await ctx.params;
  if (!isAddress(wallet)) return badRequest("invalid wallet");
  const policy = await getOrCreatePolicy(wallet as Address, agentId);
  return NextResponse.json(policy);
}

export async function PUT(req: Request, ctx: Params) {
  const { wallet, agentId } = await ctx.params;
  if (!isAddress(wallet)) return badRequest("invalid wallet");

  let parsed: Policy;
  try {
    const json = await req.json();
    parsed = PolicySchema.parse(json) as Policy;
  } catch (err) {
    return badRequest(`invalid body: ${(err as Error).message}`);
  }

  if (parsed.wallet.toLowerCase() !== wallet.toLowerCase()) {
    return badRequest("wallet mismatch");
  }
  if (parsed.agentId !== agentId) {
    return badRequest("agentId mismatch");
  }

  const saved = await upsertPolicy({ ...parsed, updatedAt: Date.now() });
  return NextResponse.json(saved);
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function isAddress(s: string): s is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}
