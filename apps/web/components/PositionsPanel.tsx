"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { formatUsd, shortAddress } from "@/lib/utils";

interface PositionDto {
  pool: {
    address: Address;
    symbol: string;
    stable: boolean;
    token0: { address: Address; symbol: string; decimals: number };
    token1: { address: Address; symbol: string; decimals: number };
    reserve0: string;
    reserve1: string;
    totalSupply: string;
  };
  lpBalanceWallet: string;
  lpBalanceStaked: string;
  lpBalanceTotal: string;
  gauge: Address;
  earnedAero: string;
  shareBps: number;
  valueUsd: number | null;
}

export function PositionsPanel({ wallet }: { wallet: Address }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["positions", wallet],
    queryFn: async () => {
      const res = await fetch(`/api/wallets/${wallet}/positions`);
      if (!res.ok) throw new Error(`positions ${res.status}`);
      return (await res.json()) as { positions: PositionDto[] };
    },
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="card animate-pulse p-6 text-sm text-text-dim">
        Loading positions…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="card p-6 text-sm text-deny">
        Failed to load positions: {(error as Error).message}
      </div>
    );
  }
  const positions = data?.positions ?? [];
  if (positions.length === 0) {
    return (
      <div className="card flex flex-col items-start gap-3 p-8">
        <h3 className="text-base">No Aerodrome positions found</h3>
        <p className="text-sm text-text-dim">
          We checked the 6 major Aerodrome pairs for{" "}
          <span className="mono">{shortAddress(wallet)}</span> on Base mainnet.
          If you LP in a different pool, you can paste its address below — full
          discovery ships next week.
        </p>
      </div>
    );
  }

  const totalUsd = positions.reduce((sum, p) => sum + (p.valueUsd ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="card-2 p-5">
        <div className="text-xs uppercase tracking-wider text-text-dim">
          Total position value
        </div>
        <div className="mt-1 text-3xl font-semibold mono">
          {formatUsd(totalUsd)}
        </div>
      </div>

      <div className="space-y-3">
        {positions.map((p) => (
          <div key={p.pool.address} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">{p.pool.symbol}</span>
                  <span
                    className={`rounded-sm px-1.5 py-0.5 text-[10px] uppercase ${
                      p.pool.stable
                        ? "bg-accent/10 text-accent"
                        : "bg-warn/10 text-warn"
                    }`}
                  >
                    {p.pool.stable ? "stable" : "volatile"}
                  </span>
                </div>
                <div className="mt-0.5 mono text-xs text-text-dim">
                  {shortAddress(p.pool.address)}
                </div>
              </div>
              <div className="text-right">
                <div className="mono text-lg">
                  {p.valueUsd !== null ? formatUsd(p.valueUsd) : "—"}
                </div>
                <div className="text-xs text-text-dim">
                  {(p.shareBps / 100).toFixed(3)}% of pool
                </div>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row
                label="LP in wallet"
                value={shortenLp(p.lpBalanceWallet)}
              />
              <Row
                label="LP staked"
                value={shortenLp(p.lpBalanceStaked)}
              />
              <Row
                label={`Earned ${p.pool.symbol.includes("AERO") ? "" : "AERO"}`}
                value={shortenLp(p.earnedAero)}
              />
              <Row
                label="Gauge"
                value={
                  p.gauge === "0x0000000000000000000000000000000000000000"
                    ? "—"
                    : shortAddress(p.gauge)
                }
                mono
              />
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <>
      <dt className="text-text-dim">{label}</dt>
      <dd className={`text-right ${mono ? "mono" : ""}`}>{value}</dd>
    </>
  );
}

function shortenLp(raw: string): string {
  // LP tokens have 18 decimals; show a compact human reading.
  const n = BigInt(raw);
  if (n === 0n) return "0";
  const whole = n / 10n ** 18n;
  const frac = n % 10n ** 18n;
  if (whole > 0n) {
    return `${whole.toString()}.${frac.toString().padStart(18, "0").slice(0, 4)}`;
  }
  // Tiny amounts: show in 1e-18 units.
  return `${(Number(n) / 1e18).toFixed(6)}`;
}
