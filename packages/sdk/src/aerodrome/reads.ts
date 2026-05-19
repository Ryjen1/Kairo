import {
  type Address,
  type PublicClient,
  formatUnits,
  getAddress,
} from "viem";

// Use a loose PublicClient type that doesn't fix the chain. This avoids
// the well-known viem mismatch where a chain-specific client (e.g. typed
// against `base`) can't be passed to a function that types its parameter
// as the generic PublicClient.
type LooseClient = PublicClient<any, any>;
import { AERODROME_BASE } from "./addresses";
import {
  ERC20_ABI,
  GAUGE_ABI,
  POOL_ABI,
  POOL_FACTORY_ABI,
  VOTER_ABI,
} from "./abi";

export interface TokenInfo {
  address: Address;
  symbol: string;
  decimals: number;
}

export interface PoolInfo {
  address: Address;
  symbol: string;
  stable: boolean;
  token0: TokenInfo;
  token1: TokenInfo;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
}

export interface Position {
  pool: PoolInfo;
  /** LP tokens held directly in the wallet (unstaked). */
  lpBalanceWallet: bigint;
  /** LP tokens staked in the gauge. */
  lpBalanceStaked: bigint;
  /** Total LP tokens (wallet + staked). */
  lpBalanceTotal: bigint;
  /** Gauge address (zero address if no gauge). */
  gauge: Address;
  /** AERO earned in the gauge, claimable. */
  earnedAero: bigint;
  /** Wallet's share of the pool, in basis points (10000 = 100%). */
  shareBps: number;
  /** USD value estimate, requires a price oracle. Null if we couldn't compute. */
  valueUsd: number | null;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

/**
 * Read all metadata about a single Aerodrome pool.
 */
export async function readPool(
  client: LooseClient,
  poolAddress: Address,
): Promise<PoolInfo> {
  const pool = getAddress(poolAddress);

  const [symbol, stable, token0Addr, token1Addr, reserves, totalSupply] =
    await Promise.all([
      client.readContract({
        address: pool,
        abi: POOL_ABI,
        functionName: "symbol",
      }),
      client.readContract({
        address: pool,
        abi: POOL_ABI,
        functionName: "stable",
      }),
      client.readContract({
        address: pool,
        abi: POOL_ABI,
        functionName: "token0",
      }),
      client.readContract({
        address: pool,
        abi: POOL_ABI,
        functionName: "token1",
      }),
      client.readContract({
        address: pool,
        abi: POOL_ABI,
        functionName: "getReserves",
      }),
      client.readContract({
        address: pool,
        abi: POOL_ABI,
        functionName: "totalSupply",
      }),
    ]);

  const [token0, token1] = await Promise.all([
    readToken(client, token0Addr),
    readToken(client, token1Addr),
  ]);

  return {
    address: pool,
    symbol,
    stable,
    token0,
    token1,
    reserve0: reserves[0],
    reserve1: reserves[1],
    totalSupply,
  };
}

export async function readToken(
  client: LooseClient,
  tokenAddress: Address,
): Promise<TokenInfo> {
  const token = getAddress(tokenAddress);
  const [symbol, decimals] = await Promise.all([
    client.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "symbol",
    }),
    client.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "decimals",
    }),
  ]);
  return { address: token, symbol, decimals };
}

/**
 * Read a wallet's position in a specific pool: wallet LP balance,
 * staked LP balance in the gauge, and earned AERO.
 */
export async function readPosition(
  client: LooseClient,
  wallet: Address,
  poolAddress: Address,
  poolInfoCache?: PoolInfo,
  priceLookup?: (token: Address) => Promise<number | null>,
): Promise<Position> {
  const pool = poolInfoCache ?? (await readPool(client, poolAddress));

  const [lpWallet, gauge] = await Promise.all([
    client.readContract({
      address: pool.address,
      abi: POOL_ABI,
      functionName: "balanceOf",
      args: [wallet],
    }),
    client.readContract({
      address: AERODROME_BASE.voter,
      abi: VOTER_ABI,
      functionName: "gauges",
      args: [pool.address],
    }),
  ]);

  let lpStaked = 0n;
  let earned = 0n;

  if (gauge && gauge !== ZERO_ADDRESS) {
    const [stakedRes, earnedRes] = await Promise.all([
      client
        .readContract({
          address: gauge,
          abi: GAUGE_ABI,
          functionName: "balanceOf",
          args: [wallet],
        })
        .catch(() => 0n),
      client
        .readContract({
          address: gauge,
          abi: GAUGE_ABI,
          functionName: "earned",
          args: [wallet],
        })
        .catch(() => 0n),
    ]);
    lpStaked = stakedRes;
    earned = earnedRes;
  }

  const lpTotal = lpWallet + lpStaked;
  const shareBps =
    pool.totalSupply === 0n
      ? 0
      : Number((lpTotal * 10_000n) / pool.totalSupply);

  let valueUsd: number | null = null;
  if (priceLookup && pool.totalSupply > 0n) {
    const [price0, price1] = await Promise.all([
      priceLookup(pool.token0.address),
      priceLookup(pool.token1.address),
    ]);
    if (price0 !== null && price1 !== null) {
      const r0 = Number(formatUnits(pool.reserve0, pool.token0.decimals));
      const r1 = Number(formatUnits(pool.reserve1, pool.token1.decimals));
      const tvl = r0 * price0 + r1 * price1;
      const shareFraction = shareBps / 10_000;
      valueUsd = tvl * shareFraction;
    }
  }

  return {
    pool,
    lpBalanceWallet: lpWallet,
    lpBalanceStaked: lpStaked,
    lpBalanceTotal: lpTotal,
    gauge,
    earnedAero: earned,
    shareBps,
    valueUsd,
  };
}

/**
 * Read all positions for a wallet across a known list of pools.
 * Pools with zero balance (both wallet and gauge) are filtered out.
 */
export async function readPositions(
  client: LooseClient,
  wallet: Address,
  pools: Address[],
  priceLookup?: (token: Address) => Promise<number | null>,
): Promise<Position[]> {
  const positions = await Promise.all(
    pools.map((p) => readPosition(client, wallet, p, undefined, priceLookup)),
  );
  return positions.filter((p) => p.lpBalanceTotal > 0n);
}

/**
 * Discover candidate pools for a wallet. v1 strategy: enumerate the factory's
 * recent pools and check balances. For production we'd index events; for now
 * we scan the most recent N pools (cheaper than a full enumeration).
 */
export async function discoverPools(
  client: LooseClient,
  options: { limit?: number; offset?: number } = {},
): Promise<Address[]> {
  const limit = options.limit ?? 200;
  const offset = options.offset ?? 0;

  const total = await client.readContract({
    address: AERODROME_BASE.poolFactory,
    abi: POOL_FACTORY_ABI,
    functionName: "allPoolsLength",
  });

  const totalNum = Number(total);
  const start = Math.max(0, totalNum - offset - limit);
  const end = Math.max(0, totalNum - offset);

  const indices: bigint[] = [];
  for (let i = start; i < end; i++) indices.push(BigInt(i));

  const pools = await Promise.all(
    indices.map((i) =>
      client.readContract({
        address: AERODROME_BASE.poolFactory,
        abi: POOL_FACTORY_ABI,
        functionName: "allPools",
        args: [i],
      }),
    ),
  );

  return pools;
}
