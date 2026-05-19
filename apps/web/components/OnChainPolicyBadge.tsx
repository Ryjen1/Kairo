"use client";

import { useReadContract } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import type { Address } from "viem";

import {
  KAIRO_POLICY_ABI,
  KAIRO_POLICY_ADDRESS,
  STEWARD_AGENT_ID,
} from "@/lib/contracts";
import { shortAddress } from "@/lib/utils";

/**
 * Read-only badge that surfaces whether the policy is mirrored on-chain.
 *
 * - If no contract address is configured (env var missing), shows a soft
 *   "off-chain only" hint with a "deploy" CTA. This is the dev state.
 * - If a contract is configured and the wallet has a policy on it, shows
 *   "verified on-chain" with the contract address.
 * - If a contract is configured but the wallet has not yet pushed a policy,
 *   shows "off-chain only" with a "publish on-chain" CTA.
 */
export function OnChainPolicyBadge({ wallet }: { wallet: Address }) {
  if (!KAIRO_POLICY_ADDRESS) {
    return (
      <div className="card-2 flex items-center justify-between gap-3 px-4 py-3 text-xs">
        <div className="text-text-dim">
          Policy stored off-chain. Deploy{" "}
          <span className="mono text-text">KairoPolicy.sol</span> to Base
          Sepolia to mirror it on-chain.
        </div>
        <a
          href="https://github.com/aomi-labs"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Deploy guide →
        </a>
      </div>
    );
  }

  return <OnChainReadout wallet={wallet} contract={KAIRO_POLICY_ADDRESS} />;
}

function OnChainReadout({
  wallet,
  contract,
}: {
  wallet: Address;
  contract: Address;
}) {
  const { data, isLoading, isError } = useReadContract({
    address: contract,
    abi: KAIRO_POLICY_ABI,
    functionName: "getPolicy",
    args: [wallet, STEWARD_AGENT_ID],
    chainId: baseSepolia.id,
    query: {
      staleTime: 30_000,
    },
  });

  if (isLoading) {
    return (
      <div className="card-2 animate-pulse px-4 py-3 text-xs text-text-dim">
        Reading on-chain policy…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="card-2 px-4 py-3 text-xs text-deny">
        Failed to read on-chain policy.
      </div>
    );
  }

  const exists = data.exists;

  if (!exists) {
    return (
      <div className="card-2 flex items-center justify-between gap-3 px-4 py-3 text-xs">
        <div className="text-text-dim">
          Off-chain only. No policy mirrored to{" "}
          <span className="mono text-text">
            {shortAddress(contract, 6, 4)}
          </span>{" "}
          yet.
        </div>
        <button
          className="rounded-md border border-line bg-surface px-3 py-1 text-text hover:bg-surface-2"
          disabled
          title="On-chain publishing ships in week 2"
        >
          Publish on-chain
        </button>
      </div>
    );
  }

  const modeLabel =
    data.mode === 0
      ? "Ask every time"
      : data.mode === 1
        ? "Allow under limits"
        : "Block";

  return (
    <div className="card-2 flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
      <div className="flex items-center gap-3">
        <span className="rounded-sm bg-accent/15 px-2 py-0.5 text-[11px] uppercase tracking-wider text-accent">
          Verified on-chain
        </span>
        <span className="text-text-dim">
          Mode <span className="text-text">{modeLabel}</span> · Cap{" "}
          <span className="mono text-text">
            ${(Number(data.maxSpendUsd6) / 1_000_000).toFixed(2)}
          </span>{" "}
          per action
        </span>
      </div>
      <a
        href={`https://sepolia.basescan.org/address/${contract}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mono text-text-dim hover:text-text"
      >
        {shortAddress(contract, 6, 4)} ↗
      </a>
    </div>
  );
}
