"use client";

import { ConnectGate } from "@/components/ConnectGate";
import { PositionsPanel } from "@/components/PositionsPanel";

export default function AppHome() {
  return (
    <ConnectGate>
      {(wallet) => (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Positions
            </h1>
            <p className="mt-1 text-sm text-text-dim">
              Your live Aerodrome LP positions on Base mainnet.
            </p>
          </div>
          <PositionsPanel wallet={wallet} />
        </div>
      )}
    </ConnectGate>
  );
}
