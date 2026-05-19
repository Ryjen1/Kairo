/**
 * Smoke test: verify Aerodrome reads work against live Base mainnet.
 * Run with: pnpm tsx scripts/smoke-aerodrome.ts
 */
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import {
  AERODROME_BASE,
  BASE_TOKENS,
  POOL_FACTORY_ABI,
  POOL_ABI,
  readPool,
  readToken,
  discoverPools,
} from "../packages/sdk/src/index.js";

const RPC_URL = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";

async function main() {
  const client = createPublicClient({
    chain: base,
    transport: http(RPC_URL, {
      batch: { batchSize: 20, wait: 16 },
    }),
    batch: { multicall: { batchSize: 1024, wait: 16 } },
  });

  console.log("→ Connected to Base mainnet");
  console.log(`  RPC: ${RPC_URL}`);

  const block = await client.getBlockNumber();
  console.log(`  Block: ${block}\n`);

  console.log("→ Reading factory pool count");
  const total = await client.readContract({
    address: AERODROME_BASE.poolFactory,
    abi: POOL_FACTORY_ABI,
    functionName: "allPoolsLength",
  });
  console.log(`  ${total} pools total\n`);

  console.log("→ Looking up WETH/USDC volatile pool");
  const wethUsdcVolatile = await client.readContract({
    address: AERODROME_BASE.poolFactory,
    abi: POOL_FACTORY_ABI,
    functionName: "getPool",
    args: [BASE_TOKENS.WETH, BASE_TOKENS.USDC, false],
  });
  console.log(`  Pool: ${wethUsdcVolatile}\n`);

  if (wethUsdcVolatile && wethUsdcVolatile !== "0x0000000000000000000000000000000000000000") {
    console.log("→ Reading pool metadata");
    const pool = await readPool(client, wethUsdcVolatile);
    console.log(`  Symbol: ${pool.symbol}`);
    console.log(`  Stable: ${pool.stable}`);
    console.log(
      `  Token0: ${pool.token0.symbol} (${pool.token0.decimals}d) — ${pool.token0.address}`,
    );
    console.log(
      `  Token1: ${pool.token1.symbol} (${pool.token1.decimals}d) — ${pool.token1.address}`,
    );
    console.log(`  Reserves: ${pool.reserve0} / ${pool.reserve1}`);
    console.log(`  TotalSupply: ${pool.totalSupply}\n`);
  }

  console.log("→ Discovering recent pools (last 5)");
  const recent = await discoverPools(client, { limit: 5 });
  for (const addr of recent) {
    console.log(`  ${addr}`);
  }

  console.log("\n✓ Smoke test passed");
}

main().catch((err) => {
  console.error("✗ Smoke test failed:", err);
  process.exit(1);
});
