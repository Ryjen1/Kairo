"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { ConnectGate } from "@/components/ConnectGate";
import { relativeTime } from "@/lib/utils";

const KNOWN_AGENTS = [
  {
    id: "steward",
    name: "Aerodrome Steward",
    description:
      "LP autopilot. Watches gauges, claims rewards, proposes rebalances when a better-yielding pool appears.",
  },
];

export default function AgentsPage() {
  return (
    <ConnectGate>
      {(wallet) => (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
            <p className="mt-1 text-sm text-text-dim">
              Install agents that act on your behalf within the policy you set.
            </p>
          </div>
          <AgentList wallet={wallet} />
        </div>
      )}
    </ConnectGate>
  );
}

function AgentList({ wallet }: { wallet: Address }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["agents", wallet],
    queryFn: async () => {
      const res = await fetch(`/api/wallets/${wallet}/agents`);
      if (!res.ok) throw new Error("failed to load agents");
      return (await res.json()) as {
        agents: { agentId: string; installedAt: number; active: boolean }[];
      };
    },
  });

  const install = useMutation({
    mutationFn: async (params: { agentId: string; action: "install" | "uninstall" }) => {
      const res = await fetch(`/api/wallets/${wallet}/agents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error("install failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents", wallet] }),
  });

  if (isLoading) return <div className="card p-6 text-text-dim">Loading…</div>;

  const installed = new Map(
    (data?.agents ?? []).map((a) => [a.agentId, a]),
  );

  return (
    <div className="space-y-3">
      {KNOWN_AGENTS.map((a) => {
        const state = installed.get(a.id);
        const isInstalled = state?.active ?? false;
        return (
          <div key={a.id} className="card flex items-start justify-between gap-6 p-5">
            <div>
              <h3 className="text-base">{a.name}</h3>
              <p className="mt-1 text-sm text-text-dim">{a.description}</p>
              {state && (
                <p className="mt-2 text-xs text-text-dim">
                  Installed {relativeTime(state.installedAt)}
                </p>
              )}
            </div>
            <button
              onClick={() =>
                install.mutate({
                  agentId: a.id,
                  action: isInstalled ? "uninstall" : "install",
                })
              }
              disabled={install.isPending}
              className={`shrink-0 rounded-md px-4 py-2 text-sm transition disabled:opacity-50 ${
                isInstalled
                  ? "border border-line text-text-dim hover:bg-surface-2"
                  : "bg-accent text-accent-fg hover:opacity-90"
              }`}
            >
              {isInstalled ? "Uninstall" : "Install"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
