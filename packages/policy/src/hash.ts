import { keccak256, stringToBytes, type Hex } from "viem";
import type { Decision, Policy, Proposal, ReceiptStatus } from "./types";

/**
 * Compute a content-addressed hash for a receipt. The proposal, policy snapshot,
 * decision, and final status are canonicalized to JSON with sorted keys, then
 * keccak256'd. This is what we expose as the public receipt id (kairo.dev/r/<hash>).
 */
export function receiptHash(input: {
  proposal: Proposal;
  policySnapshot: Policy;
  decision: Decision;
  status: ReceiptStatus;
  finalizedAt: number;
}): Hex {
  const canonical = canonicalJson(input);
  return keccak256(stringToBytes(canonical));
}

/** JSON.stringify with sorted keys and bigint-safe serialization. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, replacer);
}

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return `${value.toString()}n`;
  if (value === null) return null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value;
  // Sort keys deterministically.
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key];
  }
  return sorted;
}
