"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Logo } from "./logo";

interface ConnectGateProps {
  children: (wallet: `0x${string}`) => React.ReactNode;
}

export function ConnectGate({ children }: ConnectGateProps) {
  const { address, isConnected } = useAccount();
  if (!isConnected || !address) {
    return (
      <div className="container flex min-h-[60vh] flex-col items-center justify-center text-center">
        <Logo className="mb-6" />
        <h1 className="text-2xl font-semibold">Connect your wallet</h1>
        <p className="mt-2 max-w-md text-text-dim">
          Kairo is non-custodial. We never hold your keys. Connect to view your
          Aerodrome positions, agents, and decision history.
        </p>
        <div className="mt-6">
          <ConnectButton />
        </div>
      </div>
    );
  }
  return <>{children(address)}</>;
}
