import type { Address, Hex } from "viem";

/**
 * A proposed action from an agent. Always typed, always describes intent,
 * never raw calldata at this layer.
 */
export type Proposal =
  | SwapProposal
  | AddLiquidityProposal
  | RemoveLiquidityProposal
  | RebalanceProposal
  | ClaimRewardsProposal
  | VoteForGaugeProposal;

export interface BaseProposal {
  /** Stable id, computed by the SDK before submission. */
  id: string;
  /** Which agent proposed this. */
  agentId: string;
  /** The wallet this action would affect. */
  wallet: Address;
  /** Unix ms when the proposal was created. */
  createdAt: number;
  /** Human-readable summary. The agent writes this; Kairo never trusts it for policy decisions, only for display. */
  summary: string;
  /** Result of running this through the simulator. Required for policy decisions on spending actions. */
  simulation?: Simulation;
}

export interface SwapProposal extends BaseProposal {
  kind: "swap";
  tokenIn: Address;
  tokenOut: Address;
  amountInUsd: number;
  expectedAmountOutUsd: number;
  slippageBps: number;
  route?: Address[];
}

export interface AddLiquidityProposal extends BaseProposal {
  kind: "add_liquidity";
  pool: Address;
  tokenA: Address;
  tokenB: Address;
  amountUsd: number;
}

export interface RemoveLiquidityProposal extends BaseProposal {
  kind: "remove_liquidity";
  pool: Address;
  amountUsd: number;
}

export interface RebalanceProposal extends BaseProposal {
  kind: "rebalance";
  fromPool: Address;
  toPool: Address;
  amountUsd: number;
  /** Basis points. 400 = 4%. */
  projectedAprDeltaBps: number;
  /** Basis points. Optional, only present if simulator computed IL. */
  projectedImpermanentLossBps?: number;
}

export interface ClaimRewardsProposal extends BaseProposal {
  kind: "claim_rewards";
  pool: Address;
  estimatedRewardUsd: number;
}

export interface VoteForGaugeProposal extends BaseProposal {
  kind: "vote_for_gauge";
  gauge: Address;
  /** Basis points of total veAERO power, 0–10000. */
  weightBps: number;
}

/** Output from a simulation (Anvil fork, viem simulateContract, etc). */
export interface Simulation {
  /** True if the simulated tx would succeed. */
  success: boolean;
  /** Estimated gas used. */
  gasUsed: bigint;
  /** Per-token deltas this tx would cause for the wallet. */
  tokenDeltas: Array<{
    token: Address;
    symbol: string;
    decimals: number;
    deltaRaw: bigint;
    deltaUsd: number;
  }>;
  /** Error message if success is false. */
  error?: string;
  /** Block number the simulation ran against. */
  blockNumber: bigint;
}

/* -------------------------------------------------------------------------- */
/*                                   Policy                                   */
/* -------------------------------------------------------------------------- */

export type PolicyMode = "ask_every" | "allow_under_limits" | "block";

export interface Policy {
  /** Wallet that owns this policy. */
  wallet: Address;
  /** Agent this policy applies to (one policy per (wallet, agentId)). */
  agentId: string;
  /** Updated at unix ms. */
  updatedAt: number;
  /** Top-level decision mode for this agent. */
  mode: PolicyMode;
  rules: PolicyRules;
}

export interface PolicyRules {
  /** Max usd value of a single proposed action that can auto-approve. */
  maxSpendPerActionUsd: number;
  /** Max usd value spent across all actions in a rolling 24h window. */
  dailyCapUsd: number;
  /** Allowed pools (Aerodrome AMM pools). Empty array = no allowlist (all allowed). */
  poolAllowlist: Address[];
  /** Allowed gauges. Empty = all allowed. */
  gaugeAllowlist: Address[];
  /** Minimum projected APR delta in bps for a rebalance to auto-approve. 0 = no requirement. */
  minAprDeltaBps: number;
  /** Maximum tolerable simulated impermanent loss in bps. 0 = no requirement. */
  maxImpermanentLossBps: number;
  /** Allow claiming rewards without asking, up to this usd cap per claim. */
  autoClaimUpToUsd: number;
  /** Reject any action whose simulation would result in failure. Default true. */
  requireSuccessfulSimulation: boolean;
}

/* -------------------------------------------------------------------------- */
/*                                  Decision                                  */
/* -------------------------------------------------------------------------- */

export type DecisionKind = "auto_approve" | "requires_approval" | "denied";

export interface Decision {
  kind: DecisionKind;
  /** Human-readable, suitable to show in Telegram. */
  reason: string;
  /** Which rules matched / failed. Used for receipt explainability. */
  rulesApplied: RuleResult[];
}

export interface RuleResult {
  rule: string;
  passed: boolean;
  detail: string;
}

/* -------------------------------------------------------------------------- */
/*                                   Receipt                                  */
/* -------------------------------------------------------------------------- */

export type ReceiptStatus =
  | "pending_user"
  | "auto_approved"
  | "approved_by_user"
  | "denied_by_policy"
  | "denied_by_user"
  | "expired"
  | "executed"
  | "execution_failed";

export interface Receipt {
  /** Content-addressed: sha256 of canonical(proposal, decision, status). */
  hash: Hex;
  proposal: Proposal;
  policySnapshot: Policy;
  decision: Decision;
  status: ReceiptStatus;
  /** Who took the final action. */
  decisionActor: "policy" | "user" | "timeout";
  /** Unix ms when the receipt was finalized. */
  finalizedAt: number;
  /** On-chain tx hash if executed. */
  txHash?: Hex;
}

/* -------------------------------------------------------------------------- */
/*                                  History                                   */
/* -------------------------------------------------------------------------- */

/** Minimal slice of past receipts the policy engine needs to evaluate rolling caps. */
export interface HistoryWindow {
  /** Receipts in the last 24h for this (wallet, agentId), in any order. */
  last24h: Receipt[];
}
