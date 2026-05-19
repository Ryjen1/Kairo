"use client";

import { useState } from "react";
import { parsePolicyText, type ParseResult } from "@kairo/policy";

interface PolicyTextInputProps {
  onApply: (patch: ParseResult["patch"]) => void;
}

const EXAMPLES = [
  "Rebalance up to $500 per move, daily cap $2,000, only if APR uplift beats 4%, max IL 2%, auto-claim under $50.",
  "Ask every time.",
  "Max $300 per action, daily limit of $1k, harvest up to $25.",
];

/**
 * The Lyra-inspired "write your strategy in plain English" surface. Users
 * type a policy in natural language and Kairo parses it into structured
 * rules that the sliders below reflect.
 *
 * Deterministic regex-based parser, no LLM round-trip — fast and predictable.
 */
export function PolicyTextInput({ onApply }: PolicyTextInputProps) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParseResult | null>(null);

  function handleParse() {
    if (!text.trim()) {
      setPreview(null);
      return;
    }
    const result = parsePolicyText(text);
    setPreview(result);
  }

  function handleApply() {
    if (!preview) return;
    onApply(preview.patch);
    setText("");
    setPreview(null);
  }

  function handleExample(example: string) {
    setText(example);
    setPreview(parsePolicyText(example));
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-5 py-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-accent">
            Plain-English policy
          </span>
          <span className="text-xs text-text-dim">parses to structured rules</span>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleParse}
          rows={3}
          placeholder='Write your leash. e.g. "Rebalance up to $500, daily cap $2k, only if APR uplift beats 4%, auto-claim under $50."'
          className="w-full resize-none rounded-md border border-line bg-bg p-3 text-sm text-text placeholder:text-text-dim focus:border-accent focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-2 text-xs text-text-dim">
          <span>Try:</span>
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleExample(ex)}
              className="rounded-sm border border-line bg-surface-2 px-2 py-0.5 hover:border-accent hover:text-text"
            >
              example {i + 1}
            </button>
          ))}
        </div>

        {preview && (preview.matched.length > 0 || preview.unmatched.length > 0) && (
          <div className="rounded-md border border-line bg-bg p-3 text-xs">
            {Object.keys(preview.patch).length > 0 && (
              <div className="space-y-1">
                <div className="text-text-dim">Will apply:</div>
                <ul className="mono space-y-0.5">
                  {preview.patch.mode && (
                    <li className="text-accent">mode → {preview.patch.mode}</li>
                  )}
                  {preview.patch.maxSpendPerActionUsd !== undefined && (
                    <li className="text-accent">
                      max per action → ${preview.patch.maxSpendPerActionUsd}
                    </li>
                  )}
                  {preview.patch.dailyCapUsd !== undefined && (
                    <li className="text-accent">
                      daily cap → ${preview.patch.dailyCapUsd}
                    </li>
                  )}
                  {preview.patch.minAprDeltaBps !== undefined && (
                    <li className="text-accent">
                      min APR delta → {(preview.patch.minAprDeltaBps / 100).toFixed(2)}%
                    </li>
                  )}
                  {preview.patch.maxImpermanentLossBps !== undefined && (
                    <li className="text-accent">
                      max IL → {(preview.patch.maxImpermanentLossBps / 100).toFixed(2)}%
                    </li>
                  )}
                  {preview.patch.autoClaimUpToUsd !== undefined && (
                    <li className="text-accent">
                      auto-claim limit → ${preview.patch.autoClaimUpToUsd}
                    </li>
                  )}
                </ul>
              </div>
            )}
            {preview.unmatched.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="text-text-dim">Couldn&apos;t parse:</div>
                <ul className="space-y-0.5">
                  {preview.unmatched.map((s, i) => (
                    <li key={i} className="text-warn">
                      “{s}”
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleApply}
            disabled={!preview || Object.keys(preview.patch).length === 0}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-40"
          >
            Apply to sliders
          </button>
        </div>
      </div>
    </div>
  );
}
