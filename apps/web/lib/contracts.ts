import type { Address, Hex } from "viem";

/**
 * Kairo contract addresses, pinned per chain.
 *
 * v1 deploys to Base Sepolia only. Set NEXT_PUBLIC_KAIRO_POLICY_ADDRESS in the
 * environment after `forge script script/Deploy.s.sol` to flip the web app
 * from "no contract configured" to live on-chain reads.
 */
export const KAIRO_POLICY_ADDRESS: Address | null =
  (process.env.NEXT_PUBLIC_KAIRO_POLICY_ADDRESS as Address | undefined) ?? null;

/** Hardcoded agent id used by Steward, matches keccak256(utf8("steward")). */
export const STEWARD_AGENT_ID: Hex =
  "0x521e318892c3f2f011538a1e033f8c8cd8f85dd97e767cd081efe04f127759d4";

/**
 * Minimal ABI for KairoPolicy.sol. Only the views the web app actually uses.
 */
export const KAIRO_POLICY_ABI = [
  {
    type: "function",
    name: "getPolicy",
    stateMutability: "view",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "agentId", type: "bytes32" },
    ],
    outputs: [
      {
        components: [
          { name: "exists", type: "bool" },
          { name: "mode", type: "uint8" },
          { name: "active", type: "bool" },
          { name: "revoked", type: "bool" },
          { name: "maxSpendUsd6", type: "uint256" },
          { name: "dailyCapUsd6", type: "uint256" },
          { name: "expiresAt", type: "uint64" },
          { name: "updatedAtBlock", type: "uint256" },
          {
            components: [
              { name: "minAprDeltaBps", type: "uint32" },
              { name: "maxImpermanentLossBps", type: "uint32" },
              { name: "autoClaimUpToUsd6", type: "uint256" },
              { name: "poolAllowlist", type: "address[]" },
              { name: "gaugeAllowlist", type: "address[]" },
            ],
            name: "aerodrome",
            type: "tuple",
          },
        ],
        name: "policy",
        type: "tuple",
      },
    ],
  },
  {
    type: "function",
    name: "isActive",
    stateMutability: "view",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "agentId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "setPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "mode", type: "uint8" },
      { name: "maxSpendUsd6", type: "uint256" },
      { name: "dailyCapUsd6", type: "uint256" },
      { name: "expiresAt", type: "uint64" },
      {
        components: [
          { name: "minAprDeltaBps", type: "uint32" },
          { name: "maxImpermanentLossBps", type: "uint32" },
          { name: "autoClaimUpToUsd6", type: "uint256" },
          { name: "poolAllowlist", type: "address[]" },
          { name: "gaugeAllowlist", type: "address[]" },
        ],
        name: "aero",
        type: "tuple",
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revoke",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "totalUpdates",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "PolicySet",
    inputs: [
      { name: "wallet", type: "address", indexed: true },
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "mode", type: "uint8", indexed: false },
      { name: "maxSpendUsd6", type: "uint256", indexed: false },
      { name: "dailyCapUsd6", type: "uint256", indexed: false },
      { name: "expiresAt", type: "uint64", indexed: false },
      { name: "updatedAtBlock", type: "uint256", indexed: false },
    ],
  },
] as const;

export type OnChainPolicy = {
  exists: boolean;
  mode: number; // 0 ASK_EVERY_TIME, 1 ALLOW_UNDER_LIMITS, 2 BLOCK
  active: boolean;
  revoked: boolean;
  maxSpendUsd6: bigint;
  dailyCapUsd6: bigint;
  expiresAt: bigint;
  updatedAtBlock: bigint;
  aerodrome: {
    minAprDeltaBps: number;
    maxImpermanentLossBps: number;
    autoClaimUpToUsd6: bigint;
    poolAllowlist: readonly Address[];
    gaugeAllowlist: readonly Address[];
  };
};
