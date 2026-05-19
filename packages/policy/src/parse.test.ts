import { describe, expect, it } from "vitest";
import { parsePolicyText, applyParsePatch } from "./parse";
import { defaultPolicy } from "./defaults";
import type { Address } from "viem";

const WALLET = "0x1111111111111111111111111111111111111111" as Address;

describe("parsePolicyText — per-action cap", () => {
  it("extracts 'rebalance up to $500'", () => {
    const r = parsePolicyText("Rebalance up to $500 per move.");
    expect(r.patch.maxSpendPerActionUsd).toBe(500);
  });

  it("extracts 'max $1,200'", () => {
    const r = parsePolicyText("max $1,200 per trade");
    expect(r.patch.maxSpendPerActionUsd).toBe(1200);
  });

  it("supports $1k shorthand", () => {
    const r = parsePolicyText("up to $1k per action");
    expect(r.patch.maxSpendPerActionUsd).toBe(1000);
  });

  it("supports $2.5k shorthand", () => {
    const r = parsePolicyText("max $2.5k per move");
    expect(r.patch.maxSpendPerActionUsd).toBe(2500);
  });

  it("supports 'no more than'", () => {
    const r = parsePolicyText("no more than $300 per swap");
    expect(r.patch.maxSpendPerActionUsd).toBe(300);
  });
});

describe("parsePolicyText — daily cap", () => {
  it("extracts 'daily cap $1,000'", () => {
    const r = parsePolicyText("daily cap $1,000");
    expect(r.patch.dailyCapUsd).toBe(1000);
  });

  it("extracts 'daily limit of $2,500'", () => {
    const r = parsePolicyText("daily limit of $2,500");
    expect(r.patch.dailyCapUsd).toBe(2500);
  });

  it("supports $5k shorthand", () => {
    const r = parsePolicyText("daily max $5k");
    expect(r.patch.dailyCapUsd).toBe(5000);
  });
});

describe("parsePolicyText — APR threshold", () => {
  it("extracts 'only if APR beats 5%'", () => {
    const r = parsePolicyText("only if APR uplift beats 5%");
    expect(r.patch.minAprDeltaBps).toBe(500);
  });

  it("extracts 'minimum 3% APR uplift'", () => {
    const r = parsePolicyText("minimum 3% APR uplift");
    expect(r.patch.minAprDeltaBps).toBe(300);
  });
});

describe("parsePolicyText — IL tolerance", () => {
  it("extracts 'max IL 2%'", () => {
    const r = parsePolicyText("max IL 2%");
    expect(r.patch.maxImpermanentLossBps).toBe(200);
  });

  it("extracts 'IL under 1.5%'", () => {
    const r = parsePolicyText("impermanent loss under 1.5%");
    expect(r.patch.maxImpermanentLossBps).toBe(150);
  });
});

describe("parsePolicyText — auto-claim", () => {
  it("extracts 'auto-claim under $25'", () => {
    const r = parsePolicyText("auto-claim under $25");
    expect(r.patch.autoClaimUpToUsd).toBe(25);
  });

  it("extracts 'harvest up to $50'", () => {
    const r = parsePolicyText("harvest up to $50");
    expect(r.patch.autoClaimUpToUsd).toBe(50);
  });
});

describe("parsePolicyText — mode", () => {
  it("detects ask_every_time", () => {
    const r = parsePolicyText("Ask every time before doing anything.");
    expect(r.patch.mode).toBe("ask_every");
  });

  it("detects block", () => {
    const r = parsePolicyText("Block the agent.");
    expect(r.patch.mode).toBe("block");
  });

  it("detects allow_under_limits", () => {
    const r = parsePolicyText("Auto-approve when within policy.");
    expect(r.patch.mode).toBe("allow_under_limits");
  });
});

describe("parsePolicyText — composite", () => {
  it("extracts a full Mei-style policy from one sentence", () => {
    const text =
      "Rebalance up to $500 per move with a daily cap of $2,000, only if APR uplift beats 4%, max IL 2%, auto-claim under $50.";
    const r = parsePolicyText(text);
    expect(r.patch.maxSpendPerActionUsd).toBe(500);
    expect(r.patch.dailyCapUsd).toBe(2000);
    expect(r.patch.minAprDeltaBps).toBe(400);
    expect(r.patch.maxImpermanentLossBps).toBe(200);
    expect(r.patch.autoClaimUpToUsd).toBe(50);
  });

  it("partial extraction works when some phrases match", () => {
    const r = parsePolicyText("rebalance up to $200, and do whatever else");
    expect(r.patch.maxSpendPerActionUsd).toBe(200);
    expect(r.unmatched.length).toBeGreaterThan(0);
  });

  it("returns an empty patch for unmatched text", () => {
    const r = parsePolicyText("just trade more aggressively");
    expect(Object.keys(r.patch).length).toBe(0);
  });
});

describe("applyParsePatch", () => {
  it("merges patch into policy without dropping other rules", () => {
    const base = defaultPolicy(WALLET, "steward");
    const r = parsePolicyText("daily cap $5,000");
    const next = applyParsePatch(base, r.patch);
    expect(next.rules.dailyCapUsd).toBe(5000);
    expect(next.rules.maxSpendPerActionUsd).toBe(
      base.rules.maxSpendPerActionUsd,
    );
  });

  it("updates mode when patch contains it", () => {
    const base = defaultPolicy(WALLET, "steward");
    const r = parsePolicyText("block the agent");
    const next = applyParsePatch(base, r.patch);
    expect(next.mode).toBe("block");
  });

  it("preserves rules.aerodrome if untouched", () => {
    const base = defaultPolicy(WALLET, "steward");
    const r = parsePolicyText("rebalance up to $300");
    const next = applyParsePatch(base, r.patch);
    expect(next.rules.minAprDeltaBps).toBe(base.rules.minAprDeltaBps);
    expect(next.rules.maxImpermanentLossBps).toBe(
      base.rules.maxImpermanentLossBps,
    );
  });
});
