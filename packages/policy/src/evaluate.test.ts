import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { evaluate } from "./evaluate";
import { defaultPolicy } from "./defaults";
import { receiptHash } from "./hash";
import type {
  HistoryWindow,
  Policy,
  RebalanceProposal,
  Receipt,
  Simulation,
  SwapProposal,
  ClaimRewardsProposal,
} from "./types";

const WALLET = "0x1111111111111111111111111111111111111111" as Address;
const AGENT = "steward";
const POOL_A = "0xaaaa000000000000000000000000000000000001" as Address;
const POOL_B = "0xaaaa000000000000000000000000000000000002" as Address;
const POOL_C = "0xaaaa000000000000000000000000000000000003" as Address;
const TOKEN_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const TOKEN_WETH = "0x4200000000000000000000000000000000000006" as Address;
const GAUGE_A = "0xbbbb000000000000000000000000000000000001" as Address;

const emptyHistory: HistoryWindow = { last24h: [] };

function okSimulation(): Simulation {
  return {
    success: true,
    gasUsed: 200_000n,
    tokenDeltas: [],
    blockNumber: 18_000_000n,
  };
}

function makeRebalance(
  overrides: Partial<RebalanceProposal> = {},
): RebalanceProposal {
  return {
    id: "p_test_rebalance",
    kind: "rebalance",
    agentId: AGENT,
    wallet: WALLET,
    createdAt: Date.now(),
    summary: "Rebalance from A to B",
    simulation: okSimulation(),
    fromPool: POOL_A,
    toPool: POOL_B,
    amountUsd: 200,
    projectedAprDeltaBps: 500, // 5%
    projectedImpermanentLossBps: 100, // 1%
    ...overrides,
  };
}

function makeSwap(overrides: Partial<SwapProposal> = {}): SwapProposal {
  return {
    id: "p_test_swap",
    kind: "swap",
    agentId: AGENT,
    wallet: WALLET,
    createdAt: Date.now(),
    summary: "Swap 100 USDC for WETH",
    simulation: okSimulation(),
    tokenIn: TOKEN_USDC,
    tokenOut: TOKEN_WETH,
    amountInUsd: 100,
    expectedAmountOutUsd: 99.5,
    slippageBps: 50,
    ...overrides,
  };
}

function makeClaim(
  overrides: Partial<ClaimRewardsProposal> = {},
): ClaimRewardsProposal {
  return {
    id: "p_test_claim",
    kind: "claim_rewards",
    agentId: AGENT,
    wallet: WALLET,
    createdAt: Date.now(),
    summary: "Claim AERO from POOL_A",
    simulation: okSimulation(),
    pool: POOL_A,
    estimatedRewardUsd: 12,
    ...overrides,
  };
}

describe("evaluate — policy mode", () => {
  it("denies everything when mode=block", () => {
    const policy: Policy = { ...defaultPolicy(WALLET, AGENT), mode: "block" };
    const decision = evaluate(makeSwap(), policy, emptyHistory);
    expect(decision.kind).toBe("denied");
  });

  it("routes to user when mode=ask_every and sim is ok", () => {
    const policy: Policy = {
      ...defaultPolicy(WALLET, AGENT),
      mode: "ask_every",
    };
    const decision = evaluate(makeSwap(), policy, emptyHistory);
    expect(decision.kind).toBe("requires_approval");
  });

  it("denies on failed simulation even in ask_every mode", () => {
    const policy: Policy = {
      ...defaultPolicy(WALLET, AGENT),
      mode: "ask_every",
    };
    const proposal = makeSwap({
      simulation: {
        success: false,
        gasUsed: 0n,
        tokenDeltas: [],
        blockNumber: 18_000_000n,
        error: "ERC20: insufficient balance",
      },
    });
    const decision = evaluate(proposal, policy, emptyHistory);
    expect(decision.kind).toBe("denied");
    expect(decision.reason).toContain("insufficient balance");
  });
});

describe("evaluate — allow_under_limits / spend caps", () => {
  it("auto-approves a swap under spend cap with no allowlist", () => {
    const policy = defaultPolicy(WALLET, AGENT);
    const decision = evaluate(makeSwap(), policy, emptyHistory);
    expect(decision.kind).toBe("auto_approve");
  });

  it("routes to user when per-action spend exceeds cap", () => {
    const policy = defaultPolicy(WALLET, AGENT);
    const decision = evaluate(
      makeSwap({ amountInUsd: 500 }),
      policy,
      emptyHistory,
    );
    expect(decision.kind).toBe("requires_approval");
    expect(decision.reason).toContain("per-action cap");
  });

  it("routes to user when daily cap would be exceeded", () => {
    const policy = defaultPolicy(WALLET, AGENT);
    const past: Receipt = {
      hash: "0x00" as `0x${string}`,
      proposal: makeSwap({ id: "past-1", amountInUsd: 900 }),
      policySnapshot: policy,
      decision: {
        kind: "auto_approve",
        reason: "ok",
        rulesApplied: [],
      },
      status: "executed",
      decisionActor: "policy",
      finalizedAt: Date.now() - 1000 * 60 * 60,
    };
    const decision = evaluate(makeSwap({ amountInUsd: 200 }), policy, {
      last24h: [past],
    });
    expect(decision.kind).toBe("requires_approval");
    expect(decision.reason).toContain("24h spend");
  });
});

describe("evaluate — pool allowlist", () => {
  it("blocks add_liquidity to a non-allowlisted pool", () => {
    const policy: Policy = {
      ...defaultPolicy(WALLET, AGENT),
      rules: {
        ...defaultPolicy(WALLET, AGENT).rules,
        poolAllowlist: [POOL_A, POOL_B],
      },
    };
    const decision = evaluate(
      {
        id: "add-1",
        kind: "add_liquidity",
        agentId: AGENT,
        wallet: WALLET,
        createdAt: Date.now(),
        summary: "Add liquidity to POOL_C",
        simulation: okSimulation(),
        pool: POOL_C,
        tokenA: TOKEN_USDC,
        tokenB: TOKEN_WETH,
        amountUsd: 100,
      },
      policy,
      emptyHistory,
    );
    expect(decision.kind).toBe("requires_approval");
    expect(decision.reason).toContain("not on the allowlist");
  });

  it("allows when pool is on the allowlist", () => {
    const policy: Policy = {
      ...defaultPolicy(WALLET, AGENT),
      rules: {
        ...defaultPolicy(WALLET, AGENT).rules,
        poolAllowlist: [POOL_A],
      },
    };
    const decision = evaluate(
      {
        id: "add-2",
        kind: "add_liquidity",
        agentId: AGENT,
        wallet: WALLET,
        createdAt: Date.now(),
        summary: "Add liquidity to POOL_A",
        simulation: okSimulation(),
        pool: POOL_A,
        tokenA: TOKEN_USDC,
        tokenB: TOKEN_WETH,
        amountUsd: 100,
      },
      policy,
      emptyHistory,
    );
    expect(decision.kind).toBe("auto_approve");
  });
});

describe("evaluate — rebalance rules", () => {
  it("auto-approves a sane rebalance", () => {
    const policy = defaultPolicy(WALLET, AGENT);
    const decision = evaluate(makeRebalance(), policy, emptyHistory);
    expect(decision.kind).toBe("auto_approve");
  });

  it("routes to user when APR delta is below the threshold", () => {
    const policy = defaultPolicy(WALLET, AGENT);
    const decision = evaluate(
      makeRebalance({ projectedAprDeltaBps: 100 }), // 1%, below default 4%
      policy,
      emptyHistory,
    );
    expect(decision.kind).toBe("requires_approval");
    expect(decision.reason).toContain("APR delta");
  });

  it("routes to user when impermanent loss exceeds tolerance", () => {
    const policy = defaultPolicy(WALLET, AGENT);
    const decision = evaluate(
      makeRebalance({ projectedImpermanentLossBps: 500 }), // 5%, above default 2%
      policy,
      emptyHistory,
    );
    expect(decision.kind).toBe("requires_approval");
    expect(decision.reason).toContain("IL");
  });
});

describe("evaluate — claim rewards", () => {
  it("auto-approves small claims under the auto-claim limit", () => {
    const policy = defaultPolicy(WALLET, AGENT);
    const decision = evaluate(
      makeClaim({ estimatedRewardUsd: 12 }),
      policy,
      emptyHistory,
    );
    expect(decision.kind).toBe("auto_approve");
  });

  it("routes large claims to the user", () => {
    const policy = defaultPolicy(WALLET, AGENT);
    const decision = evaluate(
      makeClaim({ estimatedRewardUsd: 150 }), // above default 50
      policy,
      emptyHistory,
    );
    expect(decision.kind).toBe("requires_approval");
    expect(decision.reason).toContain("auto-claim");
  });
});

describe("receiptHash", () => {
  it("is deterministic for the same inputs", () => {
    const policy = defaultPolicy(WALLET, AGENT);
    const proposal = makeSwap();
    const decision = evaluate(proposal, policy, emptyHistory);
    const h1 = receiptHash({
      proposal,
      policySnapshot: policy,
      decision,
      status: "executed",
      finalizedAt: 1_700_000_000_000,
    });
    const h2 = receiptHash({
      proposal,
      policySnapshot: policy,
      decision,
      status: "executed",
      finalizedAt: 1_700_000_000_000,
    });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("changes when status changes", () => {
    const policy = defaultPolicy(WALLET, AGENT);
    const proposal = makeSwap();
    const decision = evaluate(proposal, policy, emptyHistory);
    const h1 = receiptHash({
      proposal,
      policySnapshot: policy,
      decision,
      status: "executed",
      finalizedAt: 1_700_000_000_000,
    });
    const h2 = receiptHash({
      proposal,
      policySnapshot: policy,
      decision,
      status: "denied_by_policy",
      finalizedAt: 1_700_000_000_000,
    });
    expect(h1).not.toBe(h2);
  });
});

describe("evaluate — gauge allowlist", () => {
  it("blocks gauge votes outside the allowlist", () => {
    const policy: Policy = {
      ...defaultPolicy(WALLET, AGENT),
      rules: {
        ...defaultPolicy(WALLET, AGENT).rules,
        gaugeAllowlist: [GAUGE_A],
      },
    };
    const decision = evaluate(
      {
        id: "vote-1",
        kind: "vote_for_gauge",
        agentId: AGENT,
        wallet: WALLET,
        createdAt: Date.now(),
        summary: "Vote for an unknown gauge",
        simulation: okSimulation(),
        gauge: "0xcccc000000000000000000000000000000000001" as Address,
        weightBps: 5000,
      },
      policy,
      emptyHistory,
    );
    expect(decision.kind).toBe("requires_approval");
    expect(decision.reason).toContain("allowlist");
  });
});
