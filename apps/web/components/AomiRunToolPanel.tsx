"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Play,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Zap,
} from "lucide-react";

type Status = "idle" | "running" | "ok" | "err";

interface ToolFixture {
  name: string;
  label: string;
  description: string;
  exampleArgs: Record<string, unknown>;
}

const DEMO_WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f0beB1";
const POOL_WETH_USDC = "0xcDAC0d6c6C59727a65F871236188350531885C43";
const POOL_USDC_USDBC = "0x4D69971CCd4A636c403a3C1B00c85e99bB9B5606";
const POOL_NOT_ALLOWLISTED = "0x1111111111111111111111111111111111111111";

const FIXTURES: ToolFixture[] = [
  {
    name: "get_positions",
    label: "get_positions",
    description: "Live Aerodrome LP positions for a wallet.",
    exampleArgs: { wallet: DEMO_WALLET },
  },
  {
    name: "get_policy",
    label: "get_policy",
    description: "Read the on-chain-mirrored Kairo policy for an agent.",
    exampleArgs: { wallet: DEMO_WALLET, agent_id: "steward" },
  },
  {
    name: "get_gauge_signal",
    label: "get_gauge_signal",
    description: "Vote-weighted APR + reward rate per Aerodrome pool.",
    exampleArgs: { pools: [POOL_WETH_USDC] },
  },
  {
    name: "propose_action",
    label: "propose_action",
    description: "Submit a typed action for policy evaluation.",
    exampleArgs: {
      kind: "rebalance",
      wallet: DEMO_WALLET,
      summary: "Move $200 from vAMM-WETH/USDC to sAMM-USDC/USDbC (+5.2% APR)",
      from_pool: POOL_WETH_USDC,
      to_pool: POOL_USDC_USDBC,
      amount_usd: 200,
      projected_apr_delta_bps: 520,
      projected_impermanent_loss_bps: 80,
    },
  },
  {
    name: "get_receipt",
    label: "get_receipt",
    description: "Fetch a previously-decided Kairo receipt by hash.",
    exampleArgs: {
      hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    },
  },
];

/* -------------------------------------------------------------------------- */
/*                         Rogue Steward scenario script                       */
/* -------------------------------------------------------------------------- */

interface RogueStep {
  id: string;
  label: string;
  intent: string;
  expectedStatus: "auto_approved" | "pending_user" | "denied_by_policy";
  args: Record<string, unknown>;
}

const ROGUE_SCRIPT: RogueStep[] = [
  {
    id: "within-policy",
    label: "Scenario A · within policy",
    intent: "$200 rebalance, +5.2% APR uplift, target pool allow-listed.",
    expectedStatus: "auto_approved",
    args: {
      kind: "rebalance",
      wallet: DEMO_WALLET,
      summary:
        "Move $200 from vAMM-WETH/USDC to sAMM-USDC/USDbC (+5.2% APR)",
      from_pool: POOL_WETH_USDC,
      to_pool: POOL_USDC_USDBC,
      amount_usd: 200,
      projected_apr_delta_bps: 520,
      projected_impermanent_loss_bps: 80,
    },
  },
  {
    id: "over-cap",
    label: "Scenario B · over per-action cap",
    intent: "$1,500 rebalance — exceeds the wallet's $250 per-action cap.",
    expectedStatus: "pending_user",
    args: {
      kind: "rebalance",
      wallet: DEMO_WALLET,
      summary: "Move $1,500 from vAMM-WETH/USDC to sAMM-USDC/USDbC",
      from_pool: POOL_WETH_USDC,
      to_pool: POOL_USDC_USDBC,
      amount_usd: 1500,
      projected_apr_delta_bps: 620,
      projected_impermanent_loss_bps: 100,
    },
  },
  {
    id: "denied",
    label: "Scenario C · pool not allow-listed",
    intent: "$150 add-liquidity into a pool the wallet hasn't approved.",
    expectedStatus: "denied_by_policy",
    args: {
      kind: "add_liquidity",
      wallet: DEMO_WALLET,
      summary: "Add $150 liquidity to an unknown pool",
      pool: POOL_NOT_ALLOWLISTED,
      amount_usd: 150,
    },
  },
];

/* -------------------------------------------------------------------------- */
/*                                Response types                              */
/* -------------------------------------------------------------------------- */

interface ToolEnvelope {
  status: "ready" | "async_queued";
  result?: { Ok?: unknown; Err?: string };
  tool?: string;
}

interface RunResponse {
  envelope?: ToolEnvelope;
  meta?: {
    tookMs: number;
    runner: string;
    kairoApiUrl: string;
    dispatchPath: string;
  };
  error?: string;
}

interface RogueResult {
  step: RogueStep;
  status: "running" | "ok" | "err";
  response: RunResponse | null;
  receiptHash: string | null;
  receiptStatus: string | null;
  receiptUrl: string | null;
  tookMs: number | null;
}

/* -------------------------------------------------------------------------- */

async function dispatch(name: string, args: unknown): Promise<RunResponse> {
  const res = await fetch("/api/aomi/run-tool", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, args }),
  });
  return (await res.json()) as RunResponse;
}

/**
 * Extract the receipt hash, persisted status, and public receipt URL from
 * a `propose_action` envelope. The plugin wraps the receipt under
 * `result.Ok.full.receipt` so we drill in safely without trusting shapes.
 */
function extractReceipt(response: RunResponse): {
  hash: string | null;
  status: string | null;
  url: string | null;
} {
  const ok = response.envelope?.result?.Ok as
    | {
        full?: {
          receipt?: { hash?: string; status?: string };
          url?: string;
        };
        receipt_url?: string;
        status?: string;
      }
    | undefined;
  if (!ok) return { hash: null, status: null, url: null };
  const hash = ok.full?.receipt?.hash ?? null;
  const status = ok.full?.receipt?.status ?? ok.status ?? null;
  const url = ok.full?.url ?? ok.receipt_url ?? null;
  return { hash, status, url };
}

/* -------------------------------------------------------------------------- */

export function AomiRunToolPanel() {
  // --- Single tool runner state ---
  const [selected, setSelected] = useState<ToolFixture>(FIXTURES[0]!);
  const [argsText, setArgsText] = useState<string>(
    JSON.stringify(FIXTURES[0]!.exampleArgs, null, 2),
  );
  const [status, setStatus] = useState<Status>("idle");
  const [response, setResponse] = useState<RunResponse | null>(null);
  const [argsError, setArgsError] = useState<string | null>(null);

  // --- Rogue Steward script state ---
  const [rogueResults, setRogueResults] = useState<RogueResult[] | null>(null);
  const [rogueRunning, setRogueRunning] = useState(false);

  // ---------------------------------------------------------------- Single
  function pickTool(name: string) {
    const fx = FIXTURES.find((f) => f.name === name) ?? FIXTURES[0]!;
    setSelected(fx);
    setArgsText(JSON.stringify(fx.exampleArgs, null, 2));
    setArgsError(null);
    setResponse(null);
    setStatus("idle");
  }

  async function run() {
    setStatus("running");
    setResponse(null);
    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(argsText);
      setArgsError(null);
    } catch (err) {
      setArgsError(`invalid JSON: ${(err as Error).message}`);
      setStatus("err");
      return;
    }
    try {
      const json = await dispatch(selected.name, parsedArgs);
      setResponse(json);
      if (json.error) {
        setStatus("err");
      } else if (json.envelope?.result?.Err !== undefined) {
        setStatus("err");
      } else {
        setStatus("ok");
      }
    } catch (err) {
      setResponse({ error: (err as Error).message });
      setStatus("err");
    }
  }

  const envelopeText = useMemo(() => {
    if (!response) return "";
    return JSON.stringify(response, null, 2);
  }, [response]);

  async function copyEnvelope() {
    if (!envelopeText) return;
    try {
      await navigator.clipboard.writeText(envelopeText);
    } catch {
      /* ignore */
    }
  }

  const singleReceipt = useMemo(
    () => (response ? extractReceipt(response) : null),
    [response],
  );

  // ----------------------------------------------------------------- Rogue
  //
  // The third scenario needs a tightened pool-allowlist to be guaranteed to
  // deny. We PUT the wallet's policy with a two-pool allowlist before the
  // run, then reset to the empty allowlist (default) afterwards. The two
  // policy mutations bracket the run so the wallet ends up exactly as it
  // started.
  const runRogue = useCallback(async () => {
    if (rogueRunning) return;
    setRogueRunning(true);
    // Seed every step as 'running' so they render immediately
    const seeded: RogueResult[] = ROGUE_SCRIPT.map((step) => ({
      step,
      status: "running",
      response: null,
      receiptHash: null,
      receiptStatus: null,
      receiptUrl: null,
      tookMs: null,
    }));
    setRogueResults(seeded);

    async function tightenAllowlist(): Promise<void> {
      try {
        const res = await fetch(
          `/api/policies/${DEMO_WALLET}/steward`,
        );
        if (!res.ok) return;
        const current = (await res.json()) as {
          wallet: string;
          agentId: string;
          mode: string;
          rules: { poolAllowlist: string[]; [k: string]: unknown };
          updatedAt?: number;
        };
        const tightened = {
          ...current,
          rules: {
            ...current.rules,
            poolAllowlist: [POOL_WETH_USDC, POOL_USDC_USDBC],
          },
        };
        await fetch(`/api/policies/${DEMO_WALLET}/steward`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(tightened),
        });
      } catch {
        /* best-effort */
      }
    }

    async function relaxAllowlist(): Promise<void> {
      try {
        const res = await fetch(
          `/api/policies/${DEMO_WALLET}/steward`,
        );
        if (!res.ok) return;
        const current = (await res.json()) as {
          wallet: string;
          agentId: string;
          mode: string;
          rules: { poolAllowlist: string[]; [k: string]: unknown };
        };
        const relaxed = {
          ...current,
          rules: { ...current.rules, poolAllowlist: [] },
        };
        await fetch(`/api/policies/${DEMO_WALLET}/steward`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(relaxed),
        });
      } catch {
        /* best-effort */
      }
    }

    for (let i = 0; i < ROGUE_SCRIPT.length; i++) {
      const step = ROGUE_SCRIPT[i]!;
      // Scenario C needs the allowlist tightened so the proposal is denied
      // by the policy engine for the right reason.
      if (step.id === "denied") {
        await tightenAllowlist();
      }
      let result: RogueResult;
      try {
        const json = await dispatch("propose_action", step.args);
        const isErr =
          json.error !== undefined ||
          json.envelope?.result?.Err !== undefined;
        const receipt = extractReceipt(json);
        result = {
          step,
          status: isErr ? "err" : "ok",
          response: json,
          receiptHash: receipt.hash,
          receiptStatus: receipt.status,
          receiptUrl: receipt.url,
          tookMs: json.meta?.tookMs ?? null,
        };
      } catch (err) {
        result = {
          step,
          status: "err",
          response: { error: (err as Error).message },
          receiptHash: null,
          receiptStatus: null,
          receiptUrl: null,
          tookMs: null,
        };
      }
      setRogueResults((prev) => {
        if (!prev) return prev;
        const next = [...prev];
        next[i] = result;
        return next;
      });
    }

    // Always restore the empty allowlist so re-running the demo is idempotent.
    await relaxAllowlist();
    setRogueRunning(false);
  }, [rogueRunning]);

  // ------------------------------------------------------------------- UI
  return (
    <div className="space-y-4">
      {/* Rogue Steward block ------------------------------------------------ */}
      <RogueStewardCard
        running={rogueRunning}
        results={rogueResults}
        onRun={runRogue}
      />

      {/* Tool runner block -------------------------------------------------- */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-border/50 px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs uppercase tracking-wider text-primary">
              <Sparkles className="mr-1 inline h-3.5 w-3.5" />
              try the plugin · single tool · live SDK dispatch
            </span>
            {response?.meta?.tookMs !== undefined && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {response.meta.tookMs} ms
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              tool
            </label>
            <div className="space-y-1">
              {FIXTURES.map((fx) => {
                const active = selected.name === fx.name;
                return (
                  <button
                    key={fx.name}
                    type="button"
                    onClick={() => pickTool(fx.name)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-xs transition ${
                      active
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border bg-secondary/60 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                    }`}
                  >
                    <div className="mono">{fx.label}</div>
                    <div
                      className={`mt-0.5 text-[10px] ${
                        active ? "text-foreground/70" : "text-muted-foreground"
                      }`}
                    >
                      {fx.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                args (json)
              </label>
              <textarea
                value={argsText}
                onChange={(e) => {
                  setArgsText(e.target.value);
                  setArgsError(null);
                }}
                rows={Math.min(14, Math.max(4, argsText.split("\n").length))}
                className="mt-1 w-full rounded-md border border-border bg-bg p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                spellCheck={false}
              />
              {argsError && (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-deny">
                  <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                  {argsError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] leading-snug text-muted-foreground">
                Routes through{" "}
                <span className="mono text-foreground">
                  aomi_sdk::testing::run_tool
                </span>{" "}
                against the compiled cdylib. The same code path
                <span className="mono text-foreground">
                  {" "}
                  aomi_async_tool_start
                </span>{" "}
                uses via FFI.
              </p>
              <button
                type="button"
                onClick={run}
                disabled={status === "running"}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-emerald-glow hover:shadow-glow-sm disabled:opacity-60"
              >
                {status === "running" ? (
                  <>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />
                    Dispatching…
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Run via SDK
                  </>
                )}
              </button>
            </div>

            {/* When the response carries a receipt, surface it prominently */}
            {singleReceipt?.hash && (
              <ReceiptBanner
                hash={singleReceipt.hash}
                statusLabel={singleReceipt.status}
                url={singleReceipt.url}
              />
            )}

            <div className="rounded-md border border-border bg-surface-2/60">
              <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  output · DynToolStart envelope
                </span>
                <div className="flex items-center gap-2">
                  {status === "ok" && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                      <CheckCircle2 className="h-3 w-3" /> ready · Ok
                    </span>
                  )}
                  {status === "err" && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-deny">
                      <AlertCircle className="h-3 w-3" /> error
                    </span>
                  )}
                  {envelopeText && (
                    <button
                      type="button"
                      onClick={copyEnvelope}
                      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                      aria-label="Copy envelope"
                    >
                      <Copy className="h-3 w-3" />
                      copy
                    </button>
                  )}
                </div>
              </div>
              <pre className="max-h-[360px] overflow-auto p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {status === "idle"
                  ? "// Click 'Run via SDK' to invoke this tool through the\n// real Aomi SDK dispatch path against the compiled cdylib."
                  : status === "running"
                    ? "// dispatching…"
                    : envelopeText || "// (no response)"}
              </pre>
            </div>

            {response?.meta?.dispatchPath && (
              <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
                path · {response.meta.dispatchPath}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Receipt banner                                 */
/* -------------------------------------------------------------------------- */

function ReceiptBanner({
  hash,
  statusLabel,
  url,
}: {
  hash: string;
  statusLabel: string | null;
  url: string | null;
}) {
  // The url returned by the API may be absolute (with NEXT_PUBLIC_APP_URL) or
  // empty — in either case route through /r/<hash> on the current host so the
  // link works wherever the demo runs.
  const safeUrl = url && url.startsWith("http") ? url : `/r/${hash}`;
  const short = `${hash.slice(0, 8)}…${hash.slice(-6)}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/20 bg-primary/10 px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <Zap className="h-4 w-4 text-primary" />
        <span className="text-foreground">Receipt minted</span>
        {statusLabel && (
          <span className="rounded-sm bg-primary/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
            {statusLabel.replace(/_/g, " ")}
          </span>
        )}
        <span className="mono text-xs text-muted-foreground">{short}</span>
      </div>
      <a
        href={safeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-emerald-glow"
      >
        View receipt
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           Rogue Steward block                               */
/* -------------------------------------------------------------------------- */

function RogueStewardCard({
  running,
  results,
  onRun,
}: {
  running: boolean;
  results: RogueResult[] | null;
  onRun: () => void;
}) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-border/50 px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-primary">
              <Zap className="mr-1 inline h-3.5 w-3.5" />
              rogue steward · three live SDK dispatches
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Fires three real{" "}
              <span className="mono text-foreground">propose_action</span>{" "}
              calls through the plugin and renders the receipts inline.
              One within policy, one over the spend cap, one blocked.
            </p>
          </div>
          <button
            type="button"
            onClick={onRun}
            disabled={running}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-emerald-glow hover:shadow-glow-sm disabled:opacity-60"
          >
            {running ? (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />
                Running…
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Run all three
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-3">
        {(results ?? ROGUE_SCRIPT.map(toEmpty)).map((r) => (
          <RogueResultCard key={r.step.id} result={r} />
        ))}
      </div>
    </div>
  );
}

function toEmpty(step: RogueStep): RogueResult {
  return {
    step,
    status: "running",
    response: null,
    receiptHash: null,
    receiptStatus: null,
    receiptUrl: null,
    tookMs: null,
  };
}

function RogueResultCard({ result }: { result: RogueResult }) {
  const isIdle = result.response === null && result.status === "running";
  const expected = result.step.expectedStatus;
  const actual = result.receiptStatus;
  const accent = (() => {
    if (isIdle) return "border-border bg-surface-2/40 text-muted-foreground";
    if (result.status === "err")
      return "border-deny/30 bg-deny/5 text-foreground";
    if (actual === "auto_approved")
      return "border-primary/40 bg-primary/5 text-foreground";
    if (actual === "pending_user")
      return "border-warn/40 bg-warn/5 text-foreground";
    if (actual === "denied_by_policy" || actual === "denied_by_user")
      return "border-deny/40 bg-deny/5 text-foreground";
    return "border-border bg-surface-2/40 text-foreground";
  })();

  return (
    <div className={`rounded-md border p-4 transition-colors ${accent}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {result.step.id}
          </div>
          <h4 className="mt-1 text-sm font-semibold text-foreground">
            {result.step.label}
          </h4>
        </div>
        <StatusPill
          isIdle={isIdle}
          running={result.status === "running" && result.response === null}
          actual={actual}
          expected={expected}
          isErr={result.status === "err"}
        />
      </div>
      <p className="mt-2 text-xs leading-snug text-muted-foreground">
        {result.step.intent}
      </p>

      <div className="mt-3 space-y-1.5 border-t border-border/50 pt-3 text-[11px]">
        <Row label="expected">
          <span className="mono text-foreground">{expected}</span>
        </Row>
        {actual && (
          <Row label="actual">
            <span
              className={`mono ${
                actual === expected ? "text-primary" : "text-warn"
              }`}
            >
              {actual}
            </span>
          </Row>
        )}
        {result.tookMs !== null && (
          <Row label="dispatch">
            <span className="mono inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {result.tookMs} ms
            </span>
          </Row>
        )}
        {result.receiptHash && (
          <Row label="receipt">
            <a
              href={
                result.receiptUrl && result.receiptUrl.startsWith("http")
                  ? result.receiptUrl
                  : `/r/${result.receiptHash}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="mono inline-flex items-center gap-1 text-primary hover:underline"
            >
              {result.receiptHash.slice(0, 8)}…{result.receiptHash.slice(-6)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </Row>
        )}
        {result.response?.error && (
          <p className="mt-2 text-[10px] text-deny">
            {result.response.error}
          </p>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function StatusPill({
  isIdle,
  running,
  actual,
  expected,
  isErr,
}: {
  isIdle: boolean;
  running: boolean;
  actual: string | null;
  expected: string;
  isErr: boolean;
}) {
  if (isIdle) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-border/60 bg-surface-3/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        waiting
      </span>
    );
  }
  if (running) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        dispatching
      </span>
    );
  }
  if (isErr) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-deny/30 bg-deny/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-deny">
        <AlertCircle className="h-3 w-3" />
        error
      </span>
    );
  }
  if (actual === expected) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
        <CheckCircle2 className="h-3 w-3" />
        as expected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-warn/30 bg-warn/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-warn">
      <AlertCircle className="h-3 w-3" />
      drift
    </span>
  );
}
