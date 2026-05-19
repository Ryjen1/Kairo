import { NextResponse } from "next/server";
import type { Address } from "viem";
import { readPosition, BASE_TOKENS } from "@kairo/sdk/aerodrome";
import { cachedPriceLookup, defiLlamaPriceLookup } from "@kairo/sdk";
import { getPublicClient } from "@/lib/viem";
import { POOL_FACTORY_ABI } from "@kairo/sdk/aerodrome";
import { AERODROME_BASE } from "@kairo/sdk/aerodrome";

/**
 * GET /api/wallets/:wallet/positions
 *
 * Returns the wallet's positions in a curated set of major Aerodrome pools.
 * We don't scan all 27k pools — that's not the demo's job. We check the
 * 6 biggest pairs and any extra pools passed via ?pool=0x… (repeatable).
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await ctx.params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "invalid wallet" }, { status: 400 });
  }

  const url = new URL(req.url);
  const extraPools = url.searchParams.getAll("pool") as Address[];

  const client = getPublicClient();
  const prices = cachedPriceLookup(defiLlamaPriceLookup("base"));

  // Resolve canonical pool addresses for major pairs (parallel multicall via batching).
  const majorPairs: Array<[Address, Address, boolean]> = [
    [BASE_TOKENS.WETH, BASE_TOKENS.USDC, false],
    [BASE_TOKENS.WETH, BASE_TOKENS.USDC, true],
    [BASE_TOKENS.cbETH, BASE_TOKENS.WETH, false],
    [BASE_TOKENS.USDC, BASE_TOKENS.USDbC, true],
    [BASE_TOKENS.WETH, BASE_TOKENS.AERO, false],
    [BASE_TOKENS.USDC, BASE_TOKENS.AERO, false],
  ];

  const resolved = await Promise.all(
    majorPairs.map(([a, b, stable]) =>
      client
        .readContract({
          address: AERODROME_BASE.poolFactory,
          abi: POOL_FACTORY_ABI,
          functionName: "getPool",
          args: [a, b, stable],
        })
        .catch(() => "0x0000000000000000000000000000000000000000" as Address),
    ),
  );

  const pools: Address[] = [
    ...resolved.filter(
      (a) => a && a !== "0x0000000000000000000000000000000000000000",
    ),
    ...extraPools,
  ];

  const positions = await Promise.all(
    pools.map((p) =>
      readPosition(client, wallet as Address, p, undefined, prices).catch(
        () => null,
      ),
    ),
  );

  const nonZero = positions
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .filter((p) => p.lpBalanceTotal > 0n);

  // Serialize bigints
  const serialized = nonZero.map((p) => ({
    pool: {
      address: p.pool.address,
      symbol: p.pool.symbol,
      stable: p.pool.stable,
      token0: p.pool.token0,
      token1: p.pool.token1,
      reserve0: p.pool.reserve0.toString(),
      reserve1: p.pool.reserve1.toString(),
      totalSupply: p.pool.totalSupply.toString(),
    },
    lpBalanceWallet: p.lpBalanceWallet.toString(),
    lpBalanceStaked: p.lpBalanceStaked.toString(),
    lpBalanceTotal: p.lpBalanceTotal.toString(),
    gauge: p.gauge,
    earnedAero: p.earnedAero.toString(),
    shareBps: p.shareBps,
    valueUsd: p.valueUsd,
  }));

  return NextResponse.json({ positions: serialized });
}
