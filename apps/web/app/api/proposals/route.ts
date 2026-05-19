import { NextResponse } from "next/server";
import { z } from "zod";
import type { Address } from "viem";
import {
  evaluate,
  receiptHash,
  type Decision,
  type Proposal,
  type Receipt,
  type ReceiptStatus,
} from "@kairo/policy";
import {
  getOrCreatePolicy,
  historyWindowForAgent,
  saveReceipt,
} from "@/lib/storage";

const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

const SimulationSchema = z
  .object({
    success: z.boolean(),
    gasUsed: z.union([z.string(), z.number(), z.bigint()]).transform(toBigInt),
    tokenDeltas: z.array(
      z.object({
        token: AddressSchema,
        symbol: z.string(),
        decimals: z.number(),
        deltaRaw: z
          .union([z.string(), z.number(), z.bigint()])
          .transform(toBigInt),
        deltaUsd: z.number(),
      }),
    ),
    error: z.string().optional(),
    blockNumber: z
      .union([z.string(), z.number(), z.bigint()])
      .transform(toBigInt),
  })
  .optional();

const BaseProposalSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  wallet: AddressSchema,
  createdAt: z.number(),
  summary: z.string(),
  simulation: SimulationSchema,
});

const ProposalSchema = z.discriminatedUnion("kind", [
  BaseProposalSchema.extend({
    kind: z.literal("swap"),
    tokenIn: AddressSchema,
    tokenOut: AddressSchema,
    amountInUsd: z.number(),
    expectedAmountOutUsd: z.number(),
    slippageBps: z.number(),
    route: z.array(AddressSchema).optional(),
  }),
  BaseProposalSchema.extend({
    kind: z.literal("add_liquidity"),
    pool: AddressSchema,
    tokenA: AddressSchema,
    tokenB: AddressSchema,
    amountUsd: z.number(),
  }),
  BaseProposalSchema.extend({
    kind: z.literal("remove_liquidity"),
    pool: AddressSchema,
    amountUsd: z.number(),
  }),
  BaseProposalSchema.extend({
    kind: z.literal("rebalance"),
    fromPool: AddressSchema,
    toPool: AddressSchema,
    amountUsd: z.number(),
    projectedAprDeltaBps: z.number(),
    projectedImpermanentLossBps: z.number().optional(),
  }),
  BaseProposalSchema.extend({
    kind: z.literal("claim_rewards"),
    pool: AddressSchema,
    estimatedRewardUsd: z.number(),
  }),
  BaseProposalSchema.extend({
    kind: z.literal("vote_for_gauge"),
    gauge: AddressSchema,
    weightBps: z.number(),
  }),
]);

export async function POST(req: Request) {
  let proposal: Proposal;
  try {
    const json = await req.json();
    proposal = ProposalSchema.parse(json) as unknown as Proposal;
  } catch (err) {
    return NextResponse.json(
      { error: `invalid proposal: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const wallet = proposal.wallet as Address;
  const policy = await getOrCreatePolicy(wallet, proposal.agentId);
  const history = await historyWindowForAgent(wallet, proposal.agentId);

  const decision: Decision = evaluate(proposal, policy, history);

  const status: ReceiptStatus = decisionToStatus(decision);
  const decisionActor: Receipt["decisionActor"] =
    decision.kind === "auto_approve"
      ? "policy"
      : decision.kind === "denied"
        ? "policy"
        : "user";

  const finalizedAt = Date.now();
  const hash = receiptHash({
    proposal,
    policySnapshot: policy,
    decision,
    status,
    finalizedAt,
  });

  const receipt: Receipt = {
    hash,
    proposal,
    policySnapshot: policy,
    decision,
    status,
    decisionActor,
    finalizedAt,
  };

  await saveReceipt(receipt);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  // Serialize bigints in the response so JSON.stringify doesn't choke.
  const body = JSON.parse(
    JSON.stringify(
      {
        receipt,
        executed: decision.kind === "auto_approve",
        url: `${appUrl}/r/${hash}`,
      },
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
    ),
  );
  return NextResponse.json(body);
}

function decisionToStatus(decision: Decision): ReceiptStatus {
  switch (decision.kind) {
    case "auto_approve":
      return "auto_approved";
    case "denied":
      return "denied_by_policy";
    case "requires_approval":
      return "pending_user";
  }
}

function toBigInt(v: string | number | bigint): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  return BigInt(v.replace(/n$/, ""));
}
