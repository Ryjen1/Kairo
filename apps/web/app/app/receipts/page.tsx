"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import type { Receipt } from "@kairo/policy";
import { ConnectGate } from "@/components/ConnectGate";
import { StatusBadge } from "@/components/StatusBadge";
import { formatUsd, relativeTime, shortAddress } from "@/lib/utils";

export default function ReceiptsPage() {
  return (
    <ConnectGate>
      {(wallet) => (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
            <p className="mt-1 text-sm text-text-dim">
              Every decision Kairo made on your behalf. Public, verifiable,
              shareable.
            </p>
          </div>
          <ReceiptList wallet={wallet} />
        </div>
      )}
    </ConnectGate>
  );
}

function ReceiptList({ wallet }: { wallet: Address }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["receipts", wallet],
    queryFn: async () => {
      const res = await fetch(`/api/wallets/${wallet}/receipts?limit=50`);
      if (!res.ok) throw new Error(`receipts ${res.status}`);
      return (await res.json()) as {
        receipts: Receipt[];
        nextCursor: string | null;
      };
    },
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return <div className="card p-6 text-text-dim">Loading receipts…</div>;
  }
  if (isError) {
    return (
      <div className="card p-6 text-deny">
        Failed to load: {(error as Error).message}
      </div>
    );
  }
  const receipts = data?.receipts ?? [];
  if (receipts.length === 0) {
    return (
      <div className="card p-8 text-text-dim">
        No receipts yet. Once Steward starts proposing actions, you&apos;ll see
        each decision listed here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {receipts.map((r) => (
        <Link
          key={r.hash}
          href={`/r/${r.hash}`}
          className="card block p-5 transition hover:bg-surface-2"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                <span className="text-xs text-text-dim">
                  {relativeTime(r.finalizedAt)}
                </span>
              </div>
              <p className="mt-2 truncate text-sm">{r.proposal.summary}</p>
              <p className="mt-1 mono text-xs text-text-dim">
                {r.proposal.agentId} · {shortAddress(r.hash)}
              </p>
            </div>
            <div className="text-right text-sm text-text-dim">
              {amountLabel(r)}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function amountLabel(r: Receipt): string {
  switch (r.proposal.kind) {
    case "swap":
      return formatUsd(r.proposal.amountInUsd);
    case "add_liquidity":
    case "remove_liquidity":
    case "rebalance":
      return formatUsd(r.proposal.amountUsd);
    case "claim_rewards":
      return formatUsd(r.proposal.estimatedRewardUsd);
    case "vote_for_gauge":
      return `${(r.proposal.weightBps / 100).toFixed(1)}% vote`;
  }
}


