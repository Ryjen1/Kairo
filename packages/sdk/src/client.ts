import type { Address } from "viem";
import type { Decision, Policy, Proposal, Receipt } from "@kairo/policy";

/**
 * Thin client used by both the web app and the Steward agent to talk to
 * the Kairo API. All endpoints live under /api/* on apps/web.
 */
export interface KairoClientOptions {
  /** Base URL of the Kairo deployment. e.g. https://kairo.dev or http://localhost:3000 */
  baseUrl: string;
  /** Optional API key for agent-authenticated calls. Not required for read endpoints. */
  apiKey?: string;
  /** Custom fetch implementation (useful in tests). */
  fetchImpl?: typeof fetch;
}

export interface SubmitProposalResponse {
  receipt: Receipt;
  /** True when the action was executed automatically. */
  executed: boolean;
  /** Public URL for the receipt. */
  url: string;
}

export class KairoClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(options: KairoClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getPolicy(wallet: Address, agentId: string): Promise<Policy | null> {
    const res = await this.request(
      `/api/policies/${wallet}/${encodeURIComponent(agentId)}`,
    );
    if (res.status === 404) return null;
    if (!res.ok) throw await asError(res);
    return (await res.json()) as Policy;
  }

  async putPolicy(policy: Policy): Promise<Policy> {
    const res = await this.request(
      `/api/policies/${policy.wallet}/${encodeURIComponent(policy.agentId)}`,
      {
        method: "PUT",
        body: JSON.stringify(policy),
        headers: { "content-type": "application/json" },
      },
    );
    if (!res.ok) throw await asError(res);
    return (await res.json()) as Policy;
  }

  async submitProposal(proposal: Proposal): Promise<SubmitProposalResponse> {
    const res = await this.request(`/api/proposals`, {
      method: "POST",
      body: JSON.stringify(proposal),
      headers: { "content-type": "application/json" },
    });
    if (!res.ok) throw await asError(res);
    return (await res.json()) as SubmitProposalResponse;
  }

  async listReceipts(
    wallet: Address,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ receipts: Receipt[]; nextCursor: string | null }> {
    const params = new URLSearchParams();
    if (options.limit) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const res = await this.request(
      `/api/wallets/${wallet}/receipts?${params}`,
    );
    if (!res.ok) throw await asError(res);
    return (await res.json()) as {
      receipts: Receipt[];
      nextCursor: string | null;
    };
  }

  async getReceipt(hash: string): Promise<Receipt | null> {
    const res = await this.request(`/api/receipts/${hash}`);
    if (res.status === 404) return null;
    if (!res.ok) throw await asError(res);
    return (await res.json()) as Receipt;
  }

  async submitUserDecision(
    receiptHash: string,
    decision: "approve" | "deny",
  ): Promise<Receipt> {
    const res = await this.request(`/api/receipts/${receiptHash}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision }),
      headers: { "content-type": "application/json" },
    });
    if (!res.ok) throw await asError(res);
    return (await res.json()) as Receipt;
  }

  private request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.apiKey) headers.set("authorization", `Bearer ${this.apiKey}`);
    return this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
  }
}

async function asError(res: Response): Promise<Error> {
  let body = "";
  try {
    body = await res.text();
  } catch {
    /* ignore */
  }
  return new Error(`Kairo API ${res.status} ${res.statusText}: ${body}`);
}
