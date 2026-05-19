"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Logo } from "@/components/logo";
import { formatUsd, relativeTime, shortAddress } from "@/lib/utils";

interface ArenaEntry {
  wallet: string;
  autoApproved: number;
  pending: number;
  executed: number;
  denied: number;
  totalValueMovedUsd: number;
  claimsClaimed: number;
  lastActive: number;
  approvalRate: number;
  score: number;
}

export default function ArenaPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["arena"],
    queryFn: async () => {
      const res = await fetch("/api/arena");
      if (!res.ok) throw new Error("arena load failed");
      return (await res.json()) as {
        arena: ArenaEntry[];
        totalWallets: number;
        updatedAt: number;
      };
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <nav className="flex items-center gap-4 text-sm text-text-dim">
            <Link href="/app" className="hover:text-text">
              Dashboard
            </Link>
            <a
              href="https://github.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="container py-12 animate-fade-in">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-accent">
              the arena · live
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              Every Steward, ranked.
            </h1>
            <p className="mt-4 max-w-2xl text-text-dim">
              Public leaderboard of wallets running Aerodrome Steward. Ranked
              by 30-day Arena score — volume moved within policy × approval
              rate × recency. Each row is a real on-chain wallet; click in for
              the full receipt trail.
            </p>
          </div>

          {isLoading ? (
            <div className="card animate-pulse p-6 text-sm text-text-dim">
              Loading the arena…
            </div>
          ) : !data || data.arena.length === 0 ? (
            <div className="card flex flex-col items-start gap-3 p-8">
              <h3 className="text-base">No Stewards active yet</h3>
              <p className="max-w-md text-sm text-text-dim">
                The arena populates as wallets install Steward and let it
                propose actions. Install it from{" "}
                <Link href="/app/agents" className="text-accent">
                  /app/agents
                </Link>{" "}
                or run the demo:
              </p>
              <pre className="card-2 w-full overflow-x-auto p-3 mono text-xs text-text-dim">
                pnpm seed:demo 0xYourWallet
              </pre>
            </div>
          ) : (
            <Leaderboard entries={data.arena} />
          )}

          {data && data.arena.length > 0 && (
            <p className="mt-6 text-center text-xs text-text-dim">
              Updated {relativeTime(data.updatedAt)} ·{" "}
              {data.totalWallets} total wallet
              {data.totalWallets === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function Leaderboard({ entries }: { entries: ArenaEntry[] }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-text-dim">
            <th className="px-5 py-3 font-medium">#</th>
            <th className="px-5 py-3 font-medium">Wallet</th>
            <th className="px-5 py-3 text-right font-medium">Volume</th>
            <th className="px-5 py-3 text-right font-medium">Actions</th>
            <th className="px-5 py-3 text-right font-medium">Approval</th>
            <th className="px-5 py-3 text-right font-medium">Score</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr
              key={e.wallet}
              className="border-b border-line/50 transition hover:bg-surface-2"
            >
              <td className="px-5 py-4 mono text-text-dim">
                {String(i + 1).padStart(2, "0")}
              </td>
              <td className="px-5 py-4">
                <div className="flex items-baseline gap-2">
                  <span className="mono">{shortAddress(e.wallet, 6, 4)}</span>
                  {i === 0 && (
                    <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                      Top
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-text-dim">
                  Active {relativeTime(e.lastActive)}
                </div>
              </td>
              <td className="px-5 py-4 text-right mono">
                {formatUsd(e.totalValueMovedUsd)}
              </td>
              <td className="px-5 py-4 text-right mono">
                <span className="text-accent">{e.autoApproved}</span>
                <span className="text-text-dim">·</span>
                <span className="text-text-dim">{e.executed}</span>
                <span className="text-text-dim">·</span>
                <span className="text-deny">{e.denied}</span>
              </td>
              <td className="px-5 py-4 text-right mono">
                {(e.approvalRate * 100).toFixed(0)}%
              </td>
              <td className="px-5 py-4 text-right mono text-text">
                {e.score.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-line bg-surface-2 px-5 py-3 text-xs text-text-dim">
        <span className="text-accent">auto-approved</span>
        <span> · </span>
        <span>executed by user</span>
        <span> · </span>
        <span className="text-deny">denied</span>
      </div>
    </div>
  );
}
