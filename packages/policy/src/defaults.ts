import type { Address } from "viem";
import type { Policy, PolicyRules } from "./types";

/**
 * Conservative defaults for a fresh Steward install. Tuned for Mei:
 * small positions, low risk tolerance, lots of asking up front.
 */
export const STEWARD_DEFAULT_RULES: PolicyRules = {
  maxSpendPerActionUsd: 250,
  dailyCapUsd: 1000,
  poolAllowlist: [],
  gaugeAllowlist: [],
  minAprDeltaBps: 400, // 4% APR delta required before auto-rebalancing
  maxImpermanentLossBps: 200, // 2% IL ceiling
  autoClaimUpToUsd: 50,
  requireSuccessfulSimulation: true,
};

export function defaultPolicy(wallet: Address, agentId: string): Policy {
  return {
    wallet,
    agentId,
    updatedAt: Date.now(),
    mode: "allow_under_limits",
    rules: STEWARD_DEFAULT_RULES,
  };
}
