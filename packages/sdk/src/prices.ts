import type { Address } from "viem";
import { BASE_TOKENS } from "./aerodrome/addresses";

/**
 * Token price lookup. v1 uses static prices for common Base tokens to keep the
 * MVP free of third-party deps. In production we'd plug in DefiLlama or a
 * Chainlink feed; the interface stays the same so the swap is trivial.
 */
export type PriceLookup = (token: Address) => Promise<number | null>;

const STATIC_USD_PRICES: Record<Address, number> = {
  [BASE_TOKENS.WETH.toLowerCase() as Address]: 3500,
  [BASE_TOKENS.cbETH.toLowerCase() as Address]: 3600,
  [BASE_TOKENS.USDC.toLowerCase() as Address]: 1,
  [BASE_TOKENS.USDbC.toLowerCase() as Address]: 1,
  [BASE_TOKENS.DAI.toLowerCase() as Address]: 1,
  [BASE_TOKENS.AERO.toLowerCase() as Address]: 0.85,
};

/** Default price lookup using static prices. Fast, deterministic, dev-friendly. */
export const staticPriceLookup: PriceLookup = async (token: Address) => {
  const lower = token.toLowerCase() as Address;
  return STATIC_USD_PRICES[lower] ?? null;
};

/**
 * Live price lookup via DefiLlama coins API. Used in production / when we
 * want real numbers in the receipt OG images.
 */
export function defiLlamaPriceLookup(chainSlug = "base"): PriceLookup {
  return async (token: Address) => {
    const key = `${chainSlug}:${token.toLowerCase()}`;
    try {
      const res = await fetch(`https://coins.llama.fi/prices/current/${key}`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        coins?: Record<string, { price?: number }>;
      };
      const price = json.coins?.[key]?.price;
      return typeof price === "number" ? price : null;
    } catch {
      return null;
    }
  };
}

/**
 * Compose: try DefiLlama first, fall back to static. Cached in-memory for the
 * lifetime of the lookup instance.
 */
export function cachedPriceLookup(primary: PriceLookup): PriceLookup {
  const cache = new Map<string, { price: number | null; at: number }>();
  const TTL_MS = 60_000;
  return async (token: Address) => {
    const key = token.toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.price;
    const price = (await primary(token)) ?? (await staticPriceLookup(token));
    cache.set(key, { price, at: Date.now() });
    return price;
  };
}
