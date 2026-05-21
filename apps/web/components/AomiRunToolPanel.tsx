"use client";

import { useMemo, useState } from "react";
import { Play, Sparkles, AlertCircle, CheckCircle2, Copy } from "lucide-react";

type Status = "idle" | "running" | "ok" | "err";

interface ToolFixture {
  name: string;
  label: string;
  description: string;
  exampleArgs: Record<string, unknown>;
}

const FIXTURES: ToolFixture[] = [
  {
    name: "get_positions",
    label: "get_positions",
    description: "Live Aerodrome LP positions for a wallet.",
    exampleArgs: { wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0beB1" },
  },
  {
    name: "get_policy",
    label: "get_policy",
    description: "Read the on-chain-mirrored Kairo policy for an agent.",
    exampleArgs: {
      wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0beB1",
      agent_id: "steward",
    },
  },
  {
    name: "get_gauge_signal",
    label: "get_gauge_signal",
    description: "Vote-weighted APR + reward rate per Aerodrome pool.",
    exampleArgs: {
      pools: ["0xcDAC0d6c6C59727a65F871236188350531885C43"],
    },
  },
  {
    name: "propose_action",
    label: "propose_action",
    description: "Submit a typed action for policy evaluation.",
    exampleArgs: {
      kind: "rebalance",
      wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0beB1",
      summary: "Move $200 from vAMM-WETH/USDC to sAMM-USDC/USDbC (+5.2% APR)",
      from_pool: "0xcDAC0d6c6C59727a65F871236188350531885C43",
      to_pool: "0x4D69971CCd4A636c403a3C1B00c85e99bB9B5606",
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

interface ResponseShape {
  envelope?: {
    status: "ready" | "async_queued";
    result?: { Ok?: unknown; Err?: string };
    tool?: string;
  };
  meta?: {
    tookMs: number;
    runner: string;
    kairoApiUrl: string;
    dispatchPath: string;
  };
  error?: string;
}

export function AomiRunToolPanel() {
  const [selected, setSelected] = useState<ToolFixture>(FIXTURES[0]!);
  const [argsText, setArgsText] = useState<string>(
    JSON.stringify(FIXTURES[0]!.exampleArgs, null, 2),
  );
  const [status, setStatus] = useState<Status>("idle");
  const [response, setResponse] = useState<ResponseShape | null>(null);
  const [argsError, setArgsError] = useState<string | null>(null);

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
      const res = await fetch("/api/aomi/run-tool", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: selected.name, args: parsedArgs }),
      });
      const json = (await res.json()) as ResponseShape;
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

  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-border/50 px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs uppercase tracking-wider text-primary">
            <Sparkles className="mr-1 inline h-3.5 w-3.5" />
            try the plugin · live SDK dispatch
          </span>
          {response?.meta?.tookMs !== undefined && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {response.meta.tookMs} ms
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-[280px_1fr]">
        {/* Tool selector */}
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

        {/* Args + run */}
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
              <span className="mono text-foreground"> aomi_async_tool_start</span>{" "}
              uses via FFI.
            </p>
            <button
              type="button"
              onClick={run}
              disabled={status === "running"}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-emerald-glow hover:shadow-glow-sm disabled:opacity-60"
            >
              <Play className="h-3.5 w-3.5" />
              {status === "running" ? "Running…" : "Run via SDK"}
            </button>
          </div>

          {/* Output */}
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
  );
}
