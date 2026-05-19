import type { Address } from "viem";

/**
 * Aerodrome Finance contract addresses on Base mainnet (chain id 8453).
 * Pinned from https://github.com/aerodrome-finance/contracts README.
 */
export const AERODROME_BASE = {
  router: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43" as Address,
  voter: "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5" as Address,
  poolFactory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da" as Address,
  aero: "0x940181a94A35A4569E4529A3CDfB74e38FD98631" as Address,
  votingEscrow: "0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4" as Address,
  rewardsDistributor: "0x227f65131A261548b057215bB1D5Ab2997964C7d" as Address,
  factoryRegistry: "0x5C3F18F06CC09CA1910767A34a20F771039E37C0" as Address,
} as const;

/** A small set of well-known Base tokens used by Aerodrome pools. */
export const BASE_TOKENS = {
  WETH: "0x4200000000000000000000000000000000000006" as Address,
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
  USDbC: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA" as Address,
  cbETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22" as Address,
  DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb" as Address,
  AERO: "0x940181a94A35A4569E4529A3CDfB74e38FD98631" as Address,
} as const;
