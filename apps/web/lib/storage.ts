import type { Address } from "viem";
import type {
  Decision,
  HistoryWindow,
  Policy,
  Proposal,
  Receipt,
  ReceiptStatus,
} from "@kairo/policy";
import { canonicalJson, defaultPolicy } from "@kairo/policy";
import { prisma } from "./db";

/**
 * JSON.stringify that handles bigints. Used for storing proposals + policies
 * + decisions in SQLite text columns. Mirrors policy's canonicalJson but is
 * exposed as a plain string serializer here for clarity.
 */
function safeStringify(value: unknown): string {
  return canonicalJson(value);
}

/**
 * Storage facade. The web app reads/writes everything through this module
 * so we can swap SQLite → Vercel KV → Postgres without touching the API
 * route handlers.
 */

export async function getPolicy(
  wallet: Address,
  agentId: string,
): Promise<Policy | null> {
  const row = await prisma.policy.findUnique({
    where: { wallet_agentId: { wallet: wallet.toLowerCase(), agentId } },
  });
  if (!row) return null;
  return rowToPolicy(row);
}

export async function getOrCreatePolicy(
  wallet: Address,
  agentId: string,
): Promise<Policy> {
  const existing = await getPolicy(wallet, agentId);
  if (existing) return existing;
  const fresh = defaultPolicy(wallet, agentId);
  return upsertPolicy(fresh);
}

export async function upsertPolicy(policy: Policy): Promise<Policy> {
  const w = policy.wallet.toLowerCase();
  const row = await prisma.policy.upsert({
    where: { wallet_agentId: { wallet: w, agentId: policy.agentId } },
    create: {
      wallet: w,
      agentId: policy.agentId,
      mode: policy.mode,
      rules: JSON.stringify(policy.rules),
    },
    update: {
      mode: policy.mode,
      rules: JSON.stringify(policy.rules),
    },
  });
  return rowToPolicy(row);
}

export async function listInstalledAgents(
  wallet: Address,
): Promise<{ agentId: string; installedAt: number; active: boolean }[]> {
  const rows = await prisma.agentInstall.findMany({
    where: { wallet: wallet.toLowerCase() },
  });
  return rows.map((r) => ({
    agentId: r.agentId,
    installedAt: r.installedAt.getTime(),
    active: r.active,
  }));
}

export async function installAgent(
  wallet: Address,
  agentId: string,
): Promise<void> {
  await prisma.agentInstall.upsert({
    where: {
      wallet_agentId: { wallet: wallet.toLowerCase(), agentId },
    },
    create: { wallet: wallet.toLowerCase(), agentId, active: true },
    update: { active: true },
  });
  await getOrCreatePolicy(wallet, agentId);
}

export async function uninstallAgent(
  wallet: Address,
  agentId: string,
): Promise<void> {
  await prisma.agentInstall.updateMany({
    where: { wallet: wallet.toLowerCase(), agentId },
    data: { active: false },
  });
}

/* -------------------------------------------------------------------------- */
/*                                  Receipts                                  */
/* -------------------------------------------------------------------------- */

export async function saveReceipt(receipt: Receipt): Promise<Receipt> {
  await prisma.receipt.upsert({
    where: { hash: receipt.hash },
    create: {
      hash: receipt.hash,
      wallet: receipt.proposal.wallet.toLowerCase(),
      agentId: receipt.proposal.agentId,
      proposalKind: receipt.proposal.kind,
      proposalJson: safeStringify(receipt.proposal),
      policyJson: safeStringify(receipt.policySnapshot),
      decisionJson: safeStringify(receipt.decision),
      status: receipt.status,
      decisionActor: receipt.decisionActor,
      finalizedAt: new Date(receipt.finalizedAt),
      txHash: receipt.txHash ?? null,
    },
    update: {
      status: receipt.status,
      decisionActor: receipt.decisionActor,
      finalizedAt: new Date(receipt.finalizedAt),
      txHash: receipt.txHash ?? null,
      decisionJson: safeStringify(receipt.decision),
    },
  });
  return receipt;
}

export async function updateReceiptStatus(
  hash: string,
  status: ReceiptStatus,
  decisionActor: Receipt["decisionActor"],
  txHash?: string,
): Promise<Receipt | null> {
  try {
    const row = await prisma.receipt.update({
      where: { hash },
      data: {
        status,
        decisionActor,
        ...(txHash ? { txHash } : {}),
        finalizedAt: new Date(),
      },
    });
    return rowToReceipt(row);
  } catch {
    return null;
  }
}

export async function getReceipt(hash: string): Promise<Receipt | null> {
  const row = await prisma.receipt.findUnique({ where: { hash } });
  return row ? rowToReceipt(row) : null;
}

export async function listReceiptsForWallet(
  wallet: Address,
  options: { limit?: number; cursor?: string } = {},
): Promise<{ receipts: Receipt[]; nextCursor: string | null }> {
  const limit = Math.min(options.limit ?? 25, 100);
  const rows = await prisma.receipt.findMany({
    where: { wallet: wallet.toLowerCase() },
    orderBy: { finalizedAt: "desc" },
    take: limit + 1,
    ...(options.cursor ? { cursor: { hash: options.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (slice[slice.length - 1]?.hash ?? null) : null;
  return { receipts: slice.map(rowToReceipt), nextCursor };
}

export async function historyWindowForAgent(
  wallet: Address,
  agentId: string,
  withinMs = 24 * 60 * 60 * 1000,
): Promise<HistoryWindow> {
  const since = new Date(Date.now() - withinMs);
  const rows = await prisma.receipt.findMany({
    where: {
      wallet: wallet.toLowerCase(),
      agentId,
      finalizedAt: { gte: since },
    },
    orderBy: { finalizedAt: "desc" },
  });
  return { last24h: rows.map(rowToReceipt) };
}

/* -------------------------------------------------------------------------- */
/*                              Row → Domain                                  */
/* -------------------------------------------------------------------------- */

type PolicyRow = Awaited<ReturnType<typeof prisma.policy.findUnique>>;
type ReceiptRow = Awaited<ReturnType<typeof prisma.receipt.findUnique>>;

function rowToPolicy(row: NonNullable<PolicyRow>): Policy {
  return {
    wallet: row.wallet as Address,
    agentId: row.agentId,
    updatedAt: row.updatedAt.getTime(),
    mode: row.mode as Policy["mode"],
    rules: JSON.parse(row.rules),
  };
}

function rowToReceipt(row: NonNullable<ReceiptRow>): Receipt {
  return {
    hash: row.hash as `0x${string}`,
    proposal: JSON.parse(row.proposalJson) as Proposal,
    policySnapshot: JSON.parse(row.policyJson) as Policy,
    decision: JSON.parse(row.decisionJson) as Decision,
    status: row.status as ReceiptStatus,
    decisionActor: row.decisionActor as Receipt["decisionActor"],
    finalizedAt: row.finalizedAt.getTime(),
    txHash: (row.txHash ?? undefined) as `0x${string}` | undefined,
  };
}
