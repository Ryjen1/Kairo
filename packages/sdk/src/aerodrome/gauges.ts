import {
  type Address,
  type PublicClient,
  formatUnits,
} from "viem";
import { AERODROME_BASE } from "./addresses";
import { GAUGE_ABI, POOL_ABI, VOTER_ABI } from "./abi";

type LooseClient = PublicClient<any, any>;

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

/**
 * Live gauge signal for a pool. This is what Steward reads to decide whether
 * a rebalance is worth proposing — vote weight shifts mean emissions shift,
 * which means APR shifts.
 */
export interface GaugeSignal {
  pool: Address;
  gauge: Address;
  /** Pool's share of total veAERO vote weight, in basis points. */
  voteShareBps: number;
  /** Reward rate as raw AERO per second emitted to this gauge. */
  rewardRatePerSecond: bigint;
  /** Total LP staked in the gauge. */
  gaugeTotalStaked: bigint;
  /** Block number the read happened at. */
  blockNumber: bigint;
}

/**
 * Read live gauge signals for a list of pools. Used by Steward to find pools
 * whose emissions are about to change relative to TVL.
 */
export async function readGaugeSignals(
  client: LooseClient,
  pools: Address[],
): Promise<GaugeSignal[]> {
  const blockNumber = await client.getBlockNumber();

  // Find each pool's gauge address.
  const gauges = await Promise.all(
    pools.map((p) =>
      client
        .readContract({
          address: AERODROME_BASE.voter,
          abi: VOTER_ABI,
          functionName: "gauges",
          args: [p],
        })
        .catch(() => ZERO),
    ),
  );

  const totalWeight = await client.readContract({
    address: AERODROME_BASE.voter,
    abi: VOTER_ABI,
    functionName: "totalWeight",
  });

  const signals: GaugeSignal[] = [];

  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i]!;
    const gauge = gauges[i]!;
    if (gauge === ZERO) continue;

    const [poolWeight, rewardRate, gaugeStaked] = await Promise.all([
      client
        .readContract({
          address: AERODROME_BASE.voter,
          abi: VOTER_ABI,
          functionName: "weights",
          args: [pool],
        })
        .catch(() => 0n),
      client
        .readContract({
          address: gauge,
          abi: GAUGE_ABI,
          functionName: "rewardRate",
        })
        .catch(() => 0n),
      client
        .readContract({
          address: gauge,
          abi: GAUGE_ABI,
          functionName: "totalSupply",
        })
        .catch(() => 0n),
    ]);

    const voteShareBps =
      totalWeight === 0n ? 0 : Number((poolWeight * 10_000n) / totalWeight);

    signals.push({
      pool,
      gauge,
      voteShareBps,
      rewardRatePerSecond: rewardRate,
      gaugeTotalStaked: gaugeStaked,
      blockNumber,
    });
  }

  return signals;
}

/**
 * Estimate annualized APR for a gauge from on-chain data.
 *
 * APR(pool) = (rewardRate * SECONDS_PER_YEAR * AERO_PRICE_USD) / (TVL_USD)
 *
 * `lpUsdValue` is the USD value of a single LP token (pool TVL / LP supply).
 * For v1 we accept this as a caller-provided estimate; in production it
 * would come from the pool reserves * token prices.
 */
export function estimateAprBps({
  signal,
  aeroPriceUsd,
  lpUsdValue,
}: {
  signal: GaugeSignal;
  aeroPriceUsd: number;
  /** USD value of one LP token (18d). */
  lpUsdValue: number;
}): number {
  if (signal.gaugeTotalStaked === 0n || lpUsdValue === 0) return 0;
  const rewardsPerYearAero = Number(
    formatUnits(signal.rewardRatePerSecond * 31_536_000n, 18),
  );
  const yearlyRewardsUsd = rewardsPerYearAero * aeroPriceUsd;
  const stakedLp = Number(formatUnits(signal.gaugeTotalStaked, 18));
  const tvlUsd = stakedLp * lpUsdValue;
  if (tvlUsd === 0) return 0;
  const apr = yearlyRewardsUsd / tvlUsd;
  return Math.round(apr * 10_000); // bps
}
