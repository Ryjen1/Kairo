"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import type { Policy, PolicyMode, ParseResult } from "@kairo/policy";
import { ConnectGate } from "@/components/ConnectGate";
import { OnChainPolicyBadge } from "@/components/OnChainPolicyBadge";
import { PolicyTextInput } from "@/components/PolicyTextInput";

const AGENT_ID = "steward";

export default function PolicyPage() {
  return (
    <ConnectGate>
      {(wallet) => (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Policy</h1>
            <p className="mt-1 text-sm text-text-dim">
              The leash for{" "}
              <span className="font-medium text-text">Aerodrome Steward</span>.
              Rules apply only when mode is set to{" "}
              <span className="font-medium text-text">Allow under limits</span>.
            </p>
          </div>
          <OnChainPolicyBadge wallet={wallet} />
          <PolicyEditor wallet={wallet} />
        </div>
      )}
    </ConnectGate>
  );
}

function PolicyEditor({ wallet }: { wallet: Address }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["policy", wallet, AGENT_ID],
    queryFn: async () => {
      const res = await fetch(`/api/policies/${wallet}/${AGENT_ID}`);
      if (!res.ok) throw new Error("policy load failed");
      return (await res.json()) as Policy;
    },
  });

  const [local, setLocal] = useState<Policy | null>(null);
  useEffect(() => {
    if (data) setLocal(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async (policy: Policy) => {
      const res = await fetch(`/api/policies/${wallet}/${AGENT_ID}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(policy),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as Policy;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policy", wallet, AGENT_ID] }),
  });

  if (isLoading || !local) {
    return <div className="card p-6 text-text-dim">Loading…</div>;
  }

  const dirty = JSON.stringify(local) !== JSON.stringify(data);

  function applyPatch(patch: ParseResult["patch"]) {
    if (!local) return;
    const { mode, ...ruleOverrides } = patch;
    setLocal({
      ...local,
      mode: mode ?? local.mode,
      rules: { ...local.rules, ...ruleOverrides },
    });
  }

  return (
    <div className="space-y-5">
      <PolicyTextInput onApply={applyPatch} />

      <ModeSection
        mode={local.mode}
        onChange={(mode) => setLocal({ ...local, mode })}
      />

      <div className={local.mode === "allow_under_limits" ? "" : "opacity-50 pointer-events-none"}>
        <SliderRow
          label="Max spend per action"
          unit="$"
          min={50}
          max={5000}
          step={50}
          value={local.rules.maxSpendPerActionUsd}
          onChange={(v) =>
            setLocal({ ...local, rules: { ...local.rules, maxSpendPerActionUsd: v } })
          }
          format={(v) => `$${v}`}
          hint="Single action ceiling. Anything bigger pings you."
        />
        <SliderRow
          label="Daily cap"
          unit="$"
          min={100}
          max={20000}
          step={100}
          value={local.rules.dailyCapUsd}
          onChange={(v) =>
            setLocal({ ...local, rules: { ...local.rules, dailyCapUsd: v } })
          }
          format={(v) => `$${v}`}
          hint="Rolling 24-hour total. After this, all actions ping you."
        />
        <SliderRow
          label="Min APR delta for auto-rebalance"
          min={0}
          max={2000}
          step={50}
          value={local.rules.minAprDeltaBps}
          onChange={(v) =>
            setLocal({ ...local, rules: { ...local.rules, minAprDeltaBps: v } })
          }
          format={(v) => `${(v / 100).toFixed(2)}%`}
          hint="Steward needs at least this APR uplift to rebalance without asking."
        />
        <SliderRow
          label="Max impermanent loss tolerance"
          min={0}
          max={1000}
          step={25}
          value={local.rules.maxImpermanentLossBps}
          onChange={(v) =>
            setLocal({ ...local, rules: { ...local.rules, maxImpermanentLossBps: v } })
          }
          format={(v) => `${(v / 100).toFixed(2)}%`}
          hint="Refuse rebalances projected to incur more IL than this."
        />
        <SliderRow
          label="Auto-claim rewards up to"
          min={0}
          max={500}
          step={5}
          value={local.rules.autoClaimUpToUsd}
          onChange={(v) =>
            setLocal({ ...local, rules: { ...local.rules, autoClaimUpToUsd: v } })
          }
          format={(v) => `$${v}`}
          hint="Reward claims under this USD value auto-approve."
        />
      </div>

      <div className="sticky bottom-4 flex items-center justify-end gap-3">
        {dirty && (
          <span className="text-xs text-text-dim">Unsaved changes</span>
        )}
        <button
          onClick={() => save.mutate(local)}
          disabled={!dirty || save.isPending}
          className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-40"
        >
          {save.isPending ? "Saving…" : "Save policy"}
        </button>
      </div>
    </div>
  );
}

function ModeSection({
  mode,
  onChange,
}: {
  mode: PolicyMode;
  onChange: (mode: PolicyMode) => void;
}) {
  const options: { value: PolicyMode; title: string; desc: string }[] = [
    {
      value: "ask_every",
      title: "Ask every time",
      desc: "Steward must ping you for every action. Safest, noisiest.",
    },
    {
      value: "allow_under_limits",
      title: "Allow under limits",
      desc: "Auto-approve actions inside your rules. Ping you when they exceed.",
    },
    {
      value: "block",
      title: "Block",
      desc: "Pause Steward. Nothing executes. Existing positions untouched.",
    },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`card cursor-pointer p-5 text-left transition ${
            mode === o.value
              ? "ring-2 ring-accent ring-offset-2 ring-offset-bg"
              : "hover:bg-surface-2"
          }`}
        >
          <div className="text-sm font-medium">{o.title}</div>
          <div className="mt-1 text-xs text-text-dim">{o.desc}</div>
        </button>
      ))}
    </div>
  );
}

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
  hint,
}: {
  label: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  hint?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="mono text-base text-accent">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[hsl(var(--accent))]"
      />
      {hint && <p className="mt-2 text-xs text-text-dim">{hint}</p>}
    </div>
  );
}
