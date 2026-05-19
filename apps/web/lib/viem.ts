import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const RPC_URL =
  process.env.BASE_RPC_URL ??
  process.env.NEXT_PUBLIC_BASE_RPC_URL ??
  "https://mainnet.base.org";

let _client: ReturnType<typeof makeClient> | null = null;

function makeClient() {
  return createPublicClient({
    chain: base,
    transport: http(RPC_URL, {
      batch: { batchSize: 20, wait: 32 },
    }),
    batch: { multicall: { batchSize: 1024, wait: 32 } },
  });
}

/** Singleton public client for Base mainnet reads, with batching configured. */
export function getPublicClient() {
  if (!_client) _client = makeClient();
  return _client;
}
