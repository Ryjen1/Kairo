import type { Address } from "viem";
import type {
  Decision,
  HistoryWindow,
  Policy,
  Proposal,
  RuleResult,
} from "./types";

/**
 * Pure function: given a proposal, the wallet's policy, and recent history,
 * decide whether to auto-approve, require user approval, or deny.
 *
 * No network calls, no LLM, no chain reads. The caller is expected to have
 * already populated proposal.simulation if relevant.
 */
export function evaluate(
  proposal: Proposal,
  policy: Policy,
  history: HistoryWindow,
): Decision {
  // Mode "block" always denies.
  if (policy.mode === "block") {
    return {
      kind: "denied",
      reason: "Agent is set to Block mode.",
      rulesApplied: [
        { rule: "policy.mode", passed: false, detail: "mode=block" },
      ],
    };
  }

  // Mode "ask_every" always punts to the user (unless simulation says it would fail).
  if (policy.mode === "ask_every") {
    const sim = checkSimulation(proposal, policy);
    if (sim && !sim.passed) {
      return {
        kind: "denied",
        reason: sim.detail,
        rulesApplied: [sim],
      };
    }
    return {
      kind: "requires_approval",
      reason: "Agent is set to Ask Every Time.",
      rulesApplied: [
        { rule: "policy.mode", passed: true, detail: "mode=ask_every" },
        ...(sim ? [sim] : []),
      ],
    };
  }

  // Mode "allow_under_limits": run all rules, auto-approve only if every rule passes.
  const results: RuleResult[] = [];

  const simResult = checkSimulation(proposal, policy);
  if (simResult) results.push(simResult);

  results.push(checkSpendCap(proposal, policy));
  results.push(checkDailyCap(proposal, policy, history));

  if (proposal.kind === "swap") {
    results.push(...checkSwap(proposal, policy));
  } else if (
    proposal.kind === "add_liquidity" ||
    proposal.kind === "remove_liquidity"
  ) {
    results.push(checkPoolAllowlist(proposal.pool, policy));
  } else if (proposal.kind === "rebalance") {
    results.push(...checkRebalance(proposal, policy));
  } else if (proposal.kind === "claim_rewards") {
    results.push(...checkClaimRewards(proposal, policy));
  } else if (proposal.kind === "vote_for_gauge") {
    results.push(checkGaugeAllowlist(proposal.gauge, policy));
  }

  const firstFail = results.find((r) => !r.passed);
  if (firstFail) {
    // Hard deny only if simulation failed; otherwise route to user.
    if (firstFail.rule === "simulation.success") {
      return {
        kind: "denied",
        reason: firstFail.detail,
        rulesApplied: results,
      };
    }
    return {
      kind: "requires_approval",
      reason: firstFail.detail,
      rulesApplied: results,
    };
  }

  return {
    kind: "auto_approve",
    reason: "All policy rules passed.",
    rulesApplied: results,
  };
}

/* -------------------------------------------------------------------------- */
/*                                Rule helpers                                */
/* -------------------------------------------------------------------------- */

function checkSimulation(
  proposal: Proposal,
  policy: Policy,
): RuleResult | null {
  if (!policy.rules.requireSuccessfulSimulation) return null;
  const sim = proposal.simulation;
  if (!sim) {
    return {
      rule: "simulation.required",
      passed: false,
      detail: "Simulation result missing — cannot auto-approve.",
    };
  }
  if (!sim.success) {
    return {
      rule: "simulation.success",
      passed: false,
      detail: sim.error ?? "Simulation reports the tx would fail.",
    };
  }
  return {
    rule: "simulation.success",
    passed: true,
    detail: `Simulated at block ${sim.blockNumber.toString()}.`,
  };
}

function checkSpendCap(proposal: Proposal, policy: Policy): RuleResult {
  const usd = usdOfProposal(proposal);
  const cap = policy.rules.maxSpendPerActionUsd;
  const passed = usd <= cap;
  return {
    rule: "spend.maxPerAction",
    passed,
    detail: passed
      ? `$${usd.toFixed(2)} <= $${cap.toFixed(2)} cap.`
      : `Action value $${usd.toFixed(2)} exceeds per-action cap of $${cap.toFixed(2)}.`,
  };
}

function checkDailyCap(
  proposal: Proposal,
  policy: Policy,
  history: HistoryWindow,
): RuleResult {
  const cap = policy.rules.dailyCapUsd;
  const proposedUsd = usdOfProposal(proposal);
  const spentLast24h = history.last24h
    .filter(
      (r) => r.status === "executed" || r.status === "approved_by_user",
    )
    .reduce((sum, r) => sum + usdOfProposal(r.proposal), 0);
  const projectedTotal = spentLast24h + proposedUsd;
  const passed = projectedTotal <= cap;
  return {
    rule: "spend.dailyCap",
    passed,
    detail: passed
      ? `Projected 24h spend $${projectedTotal.toFixed(2)} <= $${cap.toFixed(2)} cap.`
      : `Would push 24h spend to $${projectedTotal.toFixed(2)}, over $${cap.toFixed(2)} cap.`,
  };
}

function checkSwap(
  proposal: Extract<Proposal, { kind: "swap" }>,
  policy: Policy,
): RuleResult[] {
  // Swaps don't directly hit a pool allowlist (route may go through multiple pools),
  // but if a route is provided, every pool must be allowed.
  if (proposal.route && policy.rules.poolAllowlist.length > 0) {
    const offenders = proposal.route.filter(
      (p) => !addressInList(p, policy.rules.poolAllowlist),
    );
    if (offenders.length > 0) {
      return [
        {
          rule: "swap.route.poolAllowlist",
          passed: false,
          detail: `Route uses non-allowlisted pool(s): ${offenders.join(", ")}.`,
        },
      ];
    }
  }
  return [
    {
      rule: "swap.route.poolAllowlist",
      passed: true,
      detail: "Route pools are allowlisted (or no allowlist set).",
    },
  ];
}

function checkPoolAllowlist(pool: Address, policy: Policy): RuleResult {
  if (policy.rules.poolAllowlist.length === 0) {
    return {
      rule: "pool.allowlist",
      passed: true,
      detail: "No pool allowlist set.",
    };
  }
  const allowed = addressInList(pool, policy.rules.poolAllowlist);
  return {
    rule: "pool.allowlist",
    passed: allowed,
    detail: allowed
      ? `Pool ${pool} is allowlisted.`
      : `Pool ${pool} is not on the allowlist.`,
  };
}

function checkGaugeAllowlist(gauge: Address, policy: Policy): RuleResult {
  if (policy.rules.gaugeAllowlist.length === 0) {
    return {
      rule: "gauge.allowlist",
      passed: true,
      detail: "No gauge allowlist set.",
    };
  }
  const allowed = addressInList(gauge, policy.rules.gaugeAllowlist);
  return {
    rule: "gauge.allowlist",
    passed: allowed,
    detail: allowed
      ? `Gauge ${gauge} is allowlisted.`
      : `Gauge ${gauge} is not on the allowlist.`,
  };
}

function checkRebalance(
  proposal: Extract<Proposal, { kind: "rebalance" }>,
  policy: Policy,
): RuleResult[] {
  const results: RuleResult[] = [];

  // Both pools must be allowlisted (if allowlist exists).
  if (policy.rules.poolAllowlist.length > 0) {
    const fromOk = addressInList(
      proposal.fromPool,
      policy.rules.poolAllowlist,
    );
    const toOk = addressInList(proposal.toPool, policy.rules.poolAllowlist);
    results.push({
      rule: "rebalance.fromPool.allowlist",
      passed: fromOk,
      detail: fromOk
        ? `From pool allowlisted.`
        : `Source pool ${proposal.fromPool} not allowlisted.`,
    });
    results.push({
      rule: "rebalance.toPool.allowlist",
      passed: toOk,
      detail: toOk
        ? `To pool allowlisted.`
        : `Target pool ${proposal.toPool} not allowlisted.`,
    });
  }

  // APR delta must meet minimum.
  const minBps = policy.rules.minAprDeltaBps;
  if (minBps > 0) {
    const passed = proposal.projectedAprDeltaBps >= minBps;
    results.push({
      rule: "rebalance.minAprDelta",
      passed,
      detail: passed
        ? `Projected APR delta ${formatBps(proposal.projectedAprDeltaBps)} >= ${formatBps(minBps)} threshold.`
        : `Projected APR delta ${formatBps(proposal.projectedAprDeltaBps)} below ${formatBps(minBps)} threshold.`,
    });
  }

  // Impermanent loss must be under tolerance.
  const maxIlBps = policy.rules.maxImpermanentLossBps;
  if (maxIlBps > 0 && proposal.projectedImpermanentLossBps !== undefined) {
    const passed = proposal.projectedImpermanentLossBps <= maxIlBps;
    results.push({
      rule: "rebalance.maxImpermanentLoss",
      passed,
      detail: passed
        ? `Projected IL ${formatBps(proposal.projectedImpermanentLossBps)} <= ${formatBps(maxIlBps)} tolerance.`
        : `Projected IL ${formatBps(proposal.projectedImpermanentLossBps)} exceeds ${formatBps(maxIlBps)} tolerance.`,
    });
  }

  return results;
}

function checkClaimRewards(
  proposal: Extract<Proposal, { kind: "claim_rewards" }>,
  policy: Policy,
): RuleResult[] {
  const results: RuleResult[] = [];
  results.push(checkPoolAllowlist(proposal.pool, policy));

  // Auto-claim threshold: if this reward is small enough, it can auto-approve
  // regardless of the per-action spend cap (since rewards earn, not spend).
  // The per-action cap still serves as the upper bound.
  const limit = policy.rules.autoClaimUpToUsd;
  if (limit > 0) {
    const passed = proposal.estimatedRewardUsd <= limit;
    results.push({
      rule: "claim.autoClaimUpTo",
      passed,
      detail: passed
        ? `Claim ${proposal.estimatedRewardUsd.toFixed(2)} <= $${limit.toFixed(2)} auto-claim limit.`
        : `Claim ${proposal.estimatedRewardUsd.toFixed(2)} exceeds $${limit.toFixed(2)} auto-claim limit.`,
    });
  }
  return results;
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

export function usdOfProposal(proposal: Proposal): number {
  switch (proposal.kind) {
    case "swap":
      return proposal.amountInUsd;
    case "add_liquidity":
    case "remove_liquidity":
    case "rebalance":
      return proposal.amountUsd;
    case "claim_rewards":
      // Claiming spends gas, not capital; we treat USD impact as ~0 for spend rules
      // but the auto-claim limit is checked separately.
      return 0;
    case "vote_for_gauge":
      return 0;
  }
}

function addressInList(addr: Address, list: Address[]): boolean {
  const lower = addr.toLowerCase();
  return list.some((a) => a.toLowerCase() === lower);
}

function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}
