import type { Policy, PolicyMode, PolicyRules } from "./types.js";

/**
 * Plain-English → structured policy parser. Reads a natural-language leash
 * description and tries to extract policy rules. Falls back gracefully when
 * a phrase doesn't match — partial extraction returns a Partial<PolicyRules>
 * that the UI can merge into the current state.
 *
 * Deterministic, regex-based, no LLM. The Lyra-style "write a strategy in
 * plain English" experience without the LLM cost or hallucination risk.
 *
 * Supports:
 *   "rebalance up to $500" → maxSpendPerActionUsd: 500
 *   "max $200 per move"    → maxSpendPerActionUsd: 200
 *   "daily cap $1k"        → dailyCapUsd: 1000
 *   "daily limit of $2,500"→ dailyCapUsd: 2500
 *   "only if APR beats 5%" → minAprDeltaBps: 500
 *   "minimum 3% APR uplift"→ minAprDeltaBps: 300
 *   "max IL 2%"            → maxImpermanentLossBps: 200
 *   "auto-claim under $25" → autoClaimUpToUsd: 25
 *   "ask every time"       → mode: ask_every_time
 *   "block"                → mode: block
 *   "allow under limits"   → mode: allow_under_limits
 */
export interface ParseResult {
  patch: Partial<PolicyRules> & { mode?: PolicyMode };
  matched: string[];
  unmatched: string[];
}

const USD_NUM = /\$?\s*([0-9][0-9,]*\.?[0-9]*)\s*(k|m)?/i;

function parseUsd(s: string): number | null {
  const m = s.match(USD_NUM);
  if (!m) return null;
  const raw = (m[1] ?? "").replace(/,/g, "");
  let value = parseFloat(raw);
  if (!Number.isFinite(value)) return null;
  const suffix = (m[2] ?? "").toLowerCase();
  if (suffix === "k") value *= 1_000;
  if (suffix === "m") value *= 1_000_000;
  return value;
}

function parsePercent(s: string): number | null {
  const m = s.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
  if (!m) return null;
  const v = parseFloat(m[1] ?? "");
  return Number.isFinite(v) ? v : null;
}

interface Rule {
  match: RegExp;
  apply: (
    text: string,
    patch: Partial<PolicyRules> & { mode?: PolicyMode },
  ) => void;
  label: string;
}

const RULES: Rule[] = [
  // --- mode -----------------------------------------------------------------
  {
    label: "mode:block",
    match: /\b(block|pause|stop the agent)\b/i,
    apply: (_, p) => {
      p.mode = "block";
    },
  },
  {
    label: "mode:ask_every_time",
    match: /\b(ask\s+every|every\s+time|always\s+ask|require\s+approval)\b/i,
    apply: (_, p) => {
      p.mode = "ask_every";
    },
  },
  {
    label: "mode:allow_under_limits",
    match: /\b(allow\s+under\s+limits|auto[- ]?approve|under\s+policy|within\s+policy)\b/i,
    apply: (_, p) => {
      p.mode = "allow_under_limits";
    },
  },

  // --- per-action spend cap -------------------------------------------------
  {
    label: "max_per_action",
    match:
      /(?:rebalance|move|spend|swap)?\s*(?:up\s+to|max(?:imum)?|no\s+more\s+than|cap(?:ped)?\s+at)\s+\$?\s*([0-9][0-9,]*\.?[0-9]*\s*[kKmM]?)(?:\s+per\s+(?:action|move|trade|swap))?/i,
    apply: (text, p) => {
      const m = text.match(
        /(?:up\s+to|max(?:imum)?|no\s+more\s+than|cap(?:ped)?\s+at)\s+(\$?\s*[0-9][0-9,]*\.?[0-9]*\s*[kKmM]?)/i,
      );
      if (!m) return;
      const v = parseUsd(m[1] ?? "");
      if (v !== null) p.maxSpendPerActionUsd = v;
    },
  },
  {
    label: "max_per_action:max-X-per",
    match: /max\s+\$?\s*([0-9][0-9,]*\.?[0-9]*\s*[kKmM]?)\s+per/i,
    apply: (text, p) => {
      const m = text.match(/max\s+(\$?\s*[0-9][0-9,]*\.?[0-9]*\s*[kKmM]?)/i);
      if (!m) return;
      const v = parseUsd(m[1] ?? "");
      if (v !== null) p.maxSpendPerActionUsd = v;
    },
  },

  // --- daily cap ------------------------------------------------------------
  {
    label: "daily_cap",
    match: /daily\s+(?:cap|limit|max)\s*(?:of|is|=|:)?\s*\$?\s*([0-9][0-9,]*\.?[0-9]*\s*[kKmM]?)/i,
    apply: (text, p) => {
      const m = text.match(
        /daily\s+(?:cap|limit|max)\s*(?:of|is|=|:)?\s*(\$?\s*[0-9][0-9,]*\.?[0-9]*\s*[kKmM]?)/i,
      );
      if (!m) return;
      const v = parseUsd(m[1] ?? "");
      if (v !== null) p.dailyCapUsd = v;
    },
  },

  // --- APR delta threshold --------------------------------------------------
  // Matches both orderings: "APR uplift beats 5%" and "minimum 3% APR uplift"
  // Lookahead is bounded to characters that aren't punctuation so we don't
  // accidentally grab a % from a different clause across a comma/semicolon.
  {
    label: "min_apr_delta",
    match:
      /(?:(?:apr|yield)\s+(?:uplift|delta|gain)\s*(?:beats|of|>|>=|over|above|exceeds|is)?\s*([0-9]+(?:\.[0-9]+)?)\s*%|([0-9]+(?:\.[0-9]+)?)\s*%\s+(?:apr|yield)\s+(?:uplift|delta|gain))/i,
    apply: (text, p) => {
      const m = text.match(
        /(?:(?:apr|yield)\s+(?:uplift|delta|gain)\s*(?:beats|of|>|>=|over|above|exceeds|is)?\s*([0-9]+(?:\.[0-9]+)?)\s*%|([0-9]+(?:\.[0-9]+)?)\s*%\s+(?:apr|yield)\s+(?:uplift|delta|gain))/i,
      );
      if (!m) return;
      const num = m[1] ?? m[2];
      if (!num) return;
      const pct = parseFloat(num);
      if (Number.isFinite(pct)) p.minAprDeltaBps = Math.round(pct * 100);
    },
  },

  // --- impermanent loss ----------------------------------------------------
  {
    label: "max_il",
    match: /(?:max(?:imum)?|tolerance|tolerate)\s+(?:il|impermanent\s+loss|imp\.?\s+loss)\s+(?:of\s+|up\s+to\s+)?([0-9]+(?:\.[0-9]+)?)\s*%/i,
    apply: (text, p) => {
      const m = text.match(
        /(?:max(?:imum)?|tolerance|tolerate)\s+(?:il|impermanent\s+loss|imp\.?\s+loss)\s+(?:of\s+|up\s+to\s+)?([0-9]+(?:\.[0-9]+)?)\s*%/i,
      );
      if (!m) return;
      const pct = parseFloat(m[1] ?? "");
      if (Number.isFinite(pct)) p.maxImpermanentLossBps = Math.round(pct * 100);
    },
  },
  {
    label: "max_il:il-under",
    match: /(?:il|impermanent\s+loss|imp\.?\s+loss)\s+(?:under|below|less\s+than)\s+([0-9]+(?:\.[0-9]+)?)\s*%/i,
    apply: (text, p) => {
      const m = text.match(
        /(?:il|impermanent\s+loss|imp\.?\s+loss)\s+(?:under|below|less\s+than)\s+([0-9]+(?:\.[0-9]+)?)\s*%/i,
      );
      if (!m) return;
      const pct = parseFloat(m[1] ?? "");
      if (Number.isFinite(pct)) p.maxImpermanentLossBps = Math.round(pct * 100);
    },
  },

  // --- auto-claim threshold -------------------------------------------------
  {
    label: "auto_claim",
    match:
      /(?:auto[- ]?claim|claim\s+rewards|harvest)(?:\s+(?:up\s+to|under|below))?\s+\$?\s*([0-9][0-9,]*\.?[0-9]*\s*[kKmM]?)/i,
    apply: (text, p) => {
      const m = text.match(
        /(?:auto[- ]?claim|claim\s+rewards|harvest)(?:\s+(?:up\s+to|under|below))?\s+(\$?\s*[0-9][0-9,]*\.?[0-9]*\s*[kKmM]?)/i,
      );
      if (!m) return;
      const v = parseUsd(m[1] ?? "");
      if (v !== null) p.autoClaimUpToUsd = v;
    },
  },
];

export function parsePolicyText(text: string): ParseResult {
  const patch: ParseResult["patch"] = {};
  const matched: string[] = [];

  // Run all rules; later rules win on conflict (rules are ordered specific → general).
  for (const r of RULES) {
    if (r.match.test(text)) {
      r.apply(text, patch);
      matched.push(r.label);
    }
  }

  const unmatched: string[] = [];
  // Split on sentence- and clause-level separators so a multi-clause input
  // like "rebalance up to $200, do whatever else" can report the second clause
  // as unmatched.
  const clauses = text
    .split(/[.;,\n]|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of clauses) {
    const hit = RULES.some((r) => r.match.test(s));
    if (!hit && s.length > 4) unmatched.push(s);
  }

  return { patch, matched, unmatched };
}

/**
 * Apply a parse patch onto an existing policy, mutating only the fields the
 * parser was confident about. The mode field, when matched, replaces; rules
 * fields when matched replace the corresponding value.
 */
export function applyParsePatch(policy: Policy, patch: ParseResult["patch"]): Policy {
  const { mode, ...ruleOverrides } = patch;
  return {
    ...policy,
    mode: mode ?? policy.mode,
    rules: { ...policy.rules, ...ruleOverrides },
    updatedAt: Date.now(),
  };
}
