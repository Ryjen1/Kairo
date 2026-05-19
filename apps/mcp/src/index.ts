#!/usr/bin/env node
/**
 * Kairo MCP server.
 *
 * Exposes Kairo's policy engine and Aerodrome reads as Model Context Protocol
 * tools. Any MCP-compatible agent (Claude Code, Cursor, ElizaOS, OpenClaw,
 * Nanobot, Continue) can connect and ask:
 *
 *   - "What Aerodrome positions does this wallet hold?"
 *   - "Would this proposed action be auto-approved under the policy?"
 *   - "What's the current vote-weighted APR for this pool?"
 *   - "Submit this proposal to Kairo and tell me the decision."
 *
 * The agent never touches keys; it sees only typed reads + policy decisions.
 *
 * Run as stdio server:
 *   pnpm --filter @kairo/mcp start
 *
 * Configure in Claude Desktop / Cursor:
 *   {
 *     "mcpServers": {
 *       "kairo": {
 *         "command": "pnpm",
 *         "args": ["--filter", "@kairo/mcp", "start"],
 *         "env": { "KAIRO_API_URL": "https://kairo.dev" }
 *       }
 *     }
 *   }
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import {
  BASE_TOKENS,
  cachedPriceLookup,
  defiLlamaPriceLookup,
  readGaugeSignals,
  readPool,
  readPositions,
  estimateAprBps,
} from "@kairo/sdk";

const API_URL = process.env.KAIRO_API_URL ?? "http://localhost:3000";
const RPC_URL = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";

const client = createPublicClient({
  chain: base,
  transport: http(RPC_URL, { batch: { batchSize: 20, wait: 32 } }),
  batch: { multicall: { batchSize: 1024, wait: 32 } },
});
const prices = cachedPriceLookup(defiLlamaPriceLookup("base"));

const server = new Server(
  {
    name: "kairo-mcp",
    version: "0.0.1",
  },
  {
    capabilities: { tools: {} },
  },
);

const TOOLS = [
  {
    name: "get_aerodrome_positions",
    description:
      "Read a wallet's live Aerodrome LP positions on Base mainnet. Returns pool, USD value, LP balance, gauge address, and earned AERO for each position.",
    inputSchema: {
      type: "object",
      properties: {
        wallet: {
          type: "string",
          description: "EVM address (0x-prefixed) to read positions for.",
        },
      },
      required: ["wallet"],
    },
  },
  {
    name: "get_gauge_signal",
    description:
      "Read live vote-weight share + reward rate for one or more Aerodrome pools. Returns the on-chain signal Steward uses to evaluate whether a rebalance is worth proposing.",
    inputSchema: {
      type: "object",
      properties: {
        pools: {
          type: "array",
          items: { type: "string" },
          description: "Array of pool contract addresses.",
        },
      },
      required: ["pools"],
    },
  },
  {
    name: "check_policy",
    description:
      "Submit a proposed action to Kairo and return the policy decision (auto_approve | requires_approval | denied) with the exact rule reasoning. Does NOT execute on-chain. Use this before broadcasting any tx to know whether the user's leash would allow it.",
    inputSchema: {
      type: "object",
      properties: {
        proposal: {
          type: "object",
          description:
            "A Kairo Proposal (see https://kairo.dev/docs/proposal-schema). Must include kind, agentId, wallet, amount, and any kind-specific fields (e.g. fromPool/toPool for rebalance).",
        },
      },
      required: ["proposal"],
    },
  },
  {
    name: "get_policy",
    description:
      "Read the current policy for a (wallet, agentId) pair. Returns mode, spend caps, allowlists, and Aerodrome-specific rules (APR delta threshold, IL tolerance, auto-claim limit).",
    inputSchema: {
      type: "object",
      properties: {
        wallet: { type: "string", description: "EVM address." },
        agentId: {
          type: "string",
          description: "Agent identifier (e.g. \"steward\").",
        },
      },
      required: ["wallet", "agentId"],
    },
  },
  {
    name: "get_receipt",
    description:
      "Fetch a Kairo receipt by hash. Returns the full proposal, simulation, decision, and policy snapshot for verification.",
    inputSchema: {
      type: "object",
      properties: {
        hash: { type: "string", description: "Receipt hash (0x...)." },
      },
      required: ["hash"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "get_aerodrome_positions": {
        const wallet = String(a.wallet) as Address;
        if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
          return errOut("invalid wallet address");
        }
        const major: Array<[Address, Address, boolean]> = [
          [BASE_TOKENS.WETH, BASE_TOKENS.USDC, false],
          [BASE_TOKENS.WETH, BASE_TOKENS.USDC, true],
          [BASE_TOKENS.cbETH, BASE_TOKENS.WETH, false],
          [BASE_TOKENS.USDC, BASE_TOKENS.USDbC, true],
          [BASE_TOKENS.WETH, BASE_TOKENS.AERO, false],
        ];
        // Resolve pool addresses via factory (parallel)
        const { AERODROME_BASE, POOL_FACTORY_ABI } = await import(
          "@kairo/sdk"
        );
        const pools = await Promise.all(
          major.map(([x, y, stable]) =>
            client
              .readContract({
                address: AERODROME_BASE.poolFactory,
                abi: POOL_FACTORY_ABI,
                functionName: "getPool",
                args: [x, y, stable],
              })
              .catch(
                () =>
                  "0x0000000000000000000000000000000000000000" as Address,
              ),
          ),
        );
        const nonZero = pools.filter(
          (p) => p !== "0x0000000000000000000000000000000000000000",
        );
        const positions = await readPositions(client, wallet, nonZero, prices);
        return okOut({
          wallet,
          positions: positions.map((p) => ({
            pool: p.pool.address,
            symbol: p.pool.symbol,
            stable: p.pool.stable,
            valueUsd: p.valueUsd,
            shareBps: p.shareBps,
            lpBalanceTotal: p.lpBalanceTotal.toString(),
            earnedAero: p.earnedAero.toString(),
            gauge: p.gauge,
          })),
        });
      }

      case "get_gauge_signal": {
        const pools = (a.pools as string[]).map((p) => p as Address);
        const signals = await readGaugeSignals(client, pools);
        const aeroPrice = (await prices(BASE_TOKENS.AERO)) ?? 0.85;
        const enriched = await Promise.all(
          signals.map(async (s) => {
            const poolInfo = await readPool(client, s.pool).catch(() => null);
            if (!poolInfo)
              return {
                pool: s.pool,
                voteShareBps: s.voteShareBps,
                aprBps: 0,
              };
            const [p0, p1] = await Promise.all([
              prices(poolInfo.token0.address),
              prices(poolInfo.token1.address),
            ]);
            if (p0 === null || p1 === null)
              return {
                pool: s.pool,
                voteShareBps: s.voteShareBps,
                aprBps: 0,
              };
            const r0 = Number(poolInfo.reserve0) / 10 ** poolInfo.token0.decimals;
            const r1 = Number(poolInfo.reserve1) / 10 ** poolInfo.token1.decimals;
            const tvl = r0 * p0 + r1 * p1;
            const lpSupply = Number(poolInfo.totalSupply) / 1e18;
            const lpUsd = lpSupply === 0 ? 0 : tvl / lpSupply;
            return {
              pool: s.pool,
              symbol: poolInfo.symbol,
              voteShareBps: s.voteShareBps,
              aprBps: estimateAprBps({
                signal: s,
                aeroPriceUsd: aeroPrice,
                lpUsdValue: lpUsd,
              }),
              tvlUsd: tvl,
            };
          }),
        );
        return okOut({ gauges: enriched });
      }

      case "check_policy": {
        const proposal = a.proposal as Record<string, unknown>;
        const res = await fetch(`${API_URL}/api/proposals`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(proposal),
        });
        const body = await res.json();
        return okOut(body);
      }

      case "get_policy": {
        const wallet = a.wallet as string;
        const agentId = a.agentId as string;
        const res = await fetch(
          `${API_URL}/api/policies/${wallet}/${encodeURIComponent(agentId)}`,
        );
        return okOut(await res.json());
      }

      case "get_receipt": {
        const hash = a.hash as string;
        const res = await fetch(`${API_URL}/api/receipts/${hash}`);
        if (res.status === 404) return errOut("receipt not found");
        return okOut(await res.json());
      }

      default:
        return errOut(`unknown tool: ${name}`);
    }
  } catch (err) {
    return errOut(`tool error: ${(err as Error).message}`);
  }
});

function okOut(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, bigintReplacer, 2),
      },
    ],
  };
}

function errOut(msg: string) {
  return {
    content: [{ type: "text" as const, text: `ERROR: ${msg}` }],
    isError: true,
  };
}

function bigintReplacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? v.toString() : v;
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[kairo-mcp] connected via stdio");
