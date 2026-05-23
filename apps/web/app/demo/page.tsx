"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Play,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Logo } from "@/components/logo";

/* -------------------------------------------------------------------------- */
/*                                Types                                       */
/* -------------------------------------------------------------------------- */

interface ScenarioMeta {
  id: "a" | "b" | "c";
  label: string;
  title: string;
  intent: string;
  expected: "auto_approved" | "pending_user" | "denied_by_policy";
  icon: React.ReactNode;
}

const SCENARIOS: ScenarioMeta[] = [
  {
    id: "a",
    label: "Scenario A",
    title: "Within policy",
    intent: "$200 rebalance with +5.2% APR uplift.",
    expected: "auto_approved",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  {
    id: "b",
    label: "Scenario B",
    title: "Over per-action cap",
    intent: "$1,500 rebalance \u2014 over the $250 cap.",
    expected: "pending_user",
    icon: <AlertCircle className="h-4 w-4" />,
  },
  {
    id: "c",
    label: "Scenario C",
    title: "Pool not allow-listed",
    intent: "$150 add-liquidity to an unknown pool.",
    expected: "denied_by_policy",
    icon: <XCircle className="h-4 w-4" />,
  },
];

interface StageEvent {
  stage?: string;
  message?: string;
  level?: string;
  tool?: string;
  t?: number;
  timestamp?: string;
  [key: string]: unknown;
}

interface ResultEnvelope {
  result?: { Ok?: unknown; Err?: string };
  status?: string;
  tool?: string;
}

interface ReceiptInfo {
  hash: string;
  url: string;
  status: string | null;
  reason: string;
}

type RunStatus = "idle" | "streaming" | "ok" | "err";

/* -------------------------------------------------------------------------- */
/*                                Page                                        */
/* -------------------------------------------------------------------------- */

export default function DemoPage() {
  const [activeScenario, setActiveScenario] = useState<ScenarioMeta | null>(
    null,
  );
  const [status, setStatus] = useState<RunStatus>("idle");
  const [stages, setStages] = useState<StageEvent[]>([]);
  const [receipt, setReceipt] = useState<ReceiptInfo | null>(null);
  const [envelope, setEnvelope] = useState<ResultEnvelope | null>(null);
  const [stats, setStats] = useState({
    totalReceipts: 0,
    autoApproved: 0,
    pending: 0,
    denied: 0,
  });
  const terminalRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<EventSource | null>(null);

  // Poll stats every 10s so the telemetry strip stays live
  useEffect(() => {
    let mounted = true;
    async function poll() {
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) return;
        const data = (await res.json()) as typeof stats;
        if (mounted) setStats(data);
      } catch {
        /* ignore */
      }
    }
    poll();
    const iv = setInterval(poll, 10_000);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [stages, receipt]);

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      sourceRef.current?.close();
    };
  }, []);

  const runScenario = useCallback((scenario: ScenarioMeta) => {
    // Tear down any previous stream
    sourceRef.current?.close();
    setActiveScenario(scenario);
    setStatus("streaming");
    setStages([]);
    setReceipt(null);
    setEnvelope(null);

    const es = new EventSource(`/api/demo/stream?scenario=${scenario.id}`);
    sourceRef.current = es;

    es.addEventListener("scenario", (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          id: string;
          intent: string;
          label: string;
        };
        setStages((prev) => [
          ...prev,
          {
            stage: "scenario.start",
            message: data.intent,
            t: 0,
          },
        ]);
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("stage", (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as StageEvent;
        setStages((prev) => [...prev, data]);
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("result", (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          envelope: ResultEnvelope;
        };
        setEnvelope(data.envelope);
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("receipt", (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as ReceiptInfo;
        setReceipt(data);
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("done", () => {
      es.close();
      sourceRef.current = null;
      setStatus((s) => (s === "err" ? "err" : "ok"));
    });

    es.onerror = () => {
      es.close();
      sourceRef.current = null;
      setStatus("err");
    };
  }, []);

  const reset = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    setStages([]);
    setReceipt(null);
    setEnvelope(null);
    setActiveScenario(null);
    setStatus("idle");
  }, []);

  return (
    <div className="relative min-h-screen">
      <div className="grid-pattern pointer-events-none absolute inset-0 opacity-30" />

      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/aomi"
              className="hidden rounded-lg px-3.5 py-2 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
            >
              Aomi plugin
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-emerald-glow hover:shadow-glow-sm"
            >
              Open app
            </Link>
          </nav>
        </div>
      </header>

      <main className="container relative animate-fade-in py-10">
        <section className="mx-auto max-w-3xl pb-8 text-center">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-primary">
            live SDK dispatch
          </p>
          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            See the plugin <span className="text-primary">run</span>.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-base text-muted-foreground">
            Three scenarios. Each click spawns our real Rust cdylib through{" "}
            <span className="mono text-foreground">
              aomi_sdk::testing::run_tool
            </span>{" "}
            and streams every dispatch event back here as it happens. The
            timestamps are real. The latencies are measured. The receipts are
            content-addressed and shareable.
          </p>
        </section>

        {/* Scenario buttons */}
        <section className="mx-auto max-w-4xl pb-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {SCENARIOS.map((s) => {
              const active = activeScenario?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => runScenario(s)}
                  disabled={status === "streaming"}
                  className={`card group cursor-pointer p-5 text-left transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    active
                      ? "border-primary/40 bg-primary/5"
                      : "hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                    {s.icon}
                    {s.label}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-foreground">
                    {s.title}
                  </div>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">
                    {s.intent}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    <Play className="h-3 w-3" />
                    click to run
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Streaming terminal — SentinelPay-style retro real-code aesthetic */}
        <section className="mx-auto max-w-3xl pb-10">
          <div
            className="overflow-hidden rounded-2xl border border-white/[0.07] shadow-2xl"
            style={{ backgroundColor: "#06060e" }}
          >
            {/* macOS-style chrome bar */}
            <div
              className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3"
              style={{ backgroundColor: "#040408" }}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "#FF5F57" }}
                />
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "#FEBC2E" }}
                />
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "#28C840" }}
                />
              </div>
              <span className="font-mono text-[10px] text-slate-600">
                kairo-aerodrome.so · {activeScenario ? `scenario ${activeScenario.id}` : "idle"}
              </span>
              <div className="flex items-center gap-2">
                {status === "streaming" && (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-cyan-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                    LIVE
                  </span>
                )}
                {status === "ok" && (
                  <span className="font-mono text-[10px] text-emerald-400">
                    ● READY
                  </span>
                )}
                {status === "err" && (
                  <span className="font-mono text-[10px] text-rose-400">
                    ● ERR
                  </span>
                )}
                {stages.length > 0 && status !== "streaming" && (
                  <button
                    onClick={reset}
                    className="font-mono text-[10px] text-slate-600 hover:text-slate-300"
                  >
                    [reset]
                  </button>
                )}
              </div>
            </div>

            {/* Log output */}
            <div
              ref={terminalRef}
              className="overflow-y-auto p-5"
              style={{
                fontFamily:
                  "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace",
                fontSize: "0.78rem",
                lineHeight: "1.8",
                minHeight: "16rem",
                maxHeight: "26rem",
              }}
            >
              {stages.length === 0 && status === "idle" && (
                <span className="text-slate-700">
                  {`// Pick a scenario above to dispatch through the real Aomi SDK plugin.`}
                </span>
              )}

              {stages.map((s, i) => (
                <StageLine key={i} event={s} />
              ))}

              {status === "streaming" && (
                <span className="cursor-blink ml-0.5 text-cyan-400">▋</span>
              )}
            </div>

            {/* Receipt banner — keeps inside the terminal container so it
                feels like an output footer, not a separate card */}
            {receipt && (
              <div
                className="border-t border-white/[0.06] px-5 py-4"
                style={{ backgroundColor: "#080812" }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                      ► receipt
                    </span>
                    {receipt.status && (
                      <span className="rounded-sm bg-emerald-500/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                        {receipt.status.replace(/_/g, " ")}
                      </span>
                    )}
                    <span className="font-mono text-xs text-slate-400">
                      {receipt.hash.slice(0, 10)}…{receipt.hash.slice(-6)}
                    </span>
                  </div>
                  <a
                    href={receipt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/40 bg-cyan-500/[0.08] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-300 transition-colors hover:bg-cyan-500/[0.15] hover:text-cyan-200"
                  >
                    open /r/{receipt.hash.slice(2, 8)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {receipt.reason && (
                  <p className="mt-2 font-mono text-[11px] text-slate-500">
                    <span className="text-slate-600">// </span>
                    {receipt.reason}
                  </p>
                )}
              </div>
            )}
          </div>

          {envelope && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                <Sparkles className="mr-1 inline h-3 w-3" />
                raw DynToolStart envelope
              </summary>
              <pre className="mt-2 overflow-auto rounded-md border border-border bg-surface-2/40 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                {JSON.stringify(envelope, null, 2)}
              </pre>
            </details>
          )}
        </section>

        {/* Telemetry */}
        <section className="mx-auto max-w-3xl pb-16">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <TelemetryCard
              label="Total receipts"
              value={stats.totalReceipts}
              icon={<Activity className="h-3.5 w-3.5" />}
            />
            <TelemetryCard
              label="Auto-approved"
              value={stats.autoApproved}
              tone="accent"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            />
            <TelemetryCard
              label="Pending"
              value={stats.pending}
              tone="warn"
              icon={<Clock className="h-3.5 w-3.5" />}
            />
            <TelemetryCard
              label="Denied"
              value={stats.denied}
              tone="deny"
              icon={<XCircle className="h-3.5 w-3.5" />}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Stage line                                       */
/* -------------------------------------------------------------------------- */
//
// Single line in the terminal. Rendered as one row of:
//   [+0042ms] stage.name › message  · field1=v1 · field2=v2
//
// Color follows a simple level palette (SentinelPay-style):
//   info     → blue        (#60a5fa)
//   success  → green       (#4ade80)
//   warning  → yellow      (#facc15)
//   error    → red         (#f87171)
//   muted    → slate       (#64748b)
//   header   → cyan        (#22d3ee)  — for scenario.start

type LogLevel = "info" | "success" | "warning" | "error" | "muted" | "header";

const LOG_COLOR: Record<LogLevel, string> = {
  info: "#60a5fa",
  success: "#4ade80",
  warning: "#facc15",
  error: "#f87171",
  muted: "#64748b",
  header: "#22d3ee",
};

function classifyStage(event: StageEvent): LogLevel {
  const stage = String(event.stage ?? "");
  if (event.level === "ERROR" || stage.endsWith(".failed")) return "error";
  if (stage === "scenario.start") return "header";

  if (stage === "policy.decision") {
    const decisionStatus = String(event["status"] ?? "");
    if (decisionStatus === "auto_approved") return "success";
    if (decisionStatus === "pending_user") return "warning";
    if (decisionStatus.startsWith("denied")) return "error";
    return "info";
  }

  if (stage === "tool.ok" || stage === "runner.done") return "success";
  if (stage === "policy.tighten" || stage === "policy.relax") return "muted";
  if (stage === "http.send" || stage === "http.recv" || stage === "decode") return "muted";
  if (stage.startsWith("tool.") || stage === "args.ok" || stage === "payload.built") {
    return "info";
  }
  if (stage === "runner.start" || stage === "runner.spawn") return "info";
  return "muted";
}

function formatTimestamp(t: number | null): string {
  if (t === null) return "         ";
  // Pad to 5 chars (e.g. " 0042" for 42ms, " 6750" for 6.7s) so columns align.
  return `+${String(t).padStart(5)}ms`;
}

function StageLine({ event }: { event: StageEvent }) {
  const stage = String(event.stage ?? "");
  const message = String(event.message ?? "");
  const t = typeof event.t === "number" ? event.t : null;
  const elapsed = typeof event.elapsed_ms === "number" ? event.elapsed_ms : null;
  const httpStatus =
    typeof event.status === "number" ? event.status : null;
  const decisionStatus =
    stage === "policy.decision" && typeof event.status === "string"
      ? (event.status as string)
      : null;

  const level = classifyStage(event);
  const color = LOG_COLOR[level];

  // Build a compact suffix of relevant fields
  const fields: string[] = [];
  if (elapsed !== null) fields.push(`${elapsed}ms`);
  if (httpStatus !== null) fields.push(`HTTP ${httpStatus}`);
  if (typeof event.method === "string" && typeof event.url === "string") {
    fields.push(`${event.method} ${shortenUrl(event.url)}`);
  }
  if (decisionStatus) fields.push(decisionStatus);
  if (typeof event.bytes === "number") fields.push(`${event.bytes}B`);
  if (
    typeof event.tool === "string" &&
    (stage === "tool.start" || stage === "runner.start")
  ) {
    fields.push(`tool=${event.tool}`);
  }
  const suffix = fields.length > 0 ? `  · ${fields.join(" · ")}` : "";

  // Render: dim grey timestamp, dim grey stage name, bright message, dim suffix.
  return (
    <div className="animate-fade-in whitespace-pre-wrap break-words">
      <span style={{ color: "#475569" }}>[{formatTimestamp(t)}] </span>
      <span style={{ color: "#64748b" }}>{stage || "·"} </span>
      <span style={{ color: "#475569" }}>›</span>
      <span style={{ color }}> {message}</span>
      <span style={{ color: "#475569" }}>{suffix}</span>
    </div>
  );
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.length > 32 ? u.pathname.slice(0, 32) + "…" : u.pathname;
  } catch {
    return url.length > 40 ? url.slice(0, 40) + "…" : url;
  }
}

/* -------------------------------------------------------------------------- */
/*                            Telemetry card                                   */
/* -------------------------------------------------------------------------- */

function TelemetryCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone?: "accent" | "warn" | "deny";
  icon: React.ReactNode;
}) {
  const toneClass =
    tone === "accent"
      ? "text-primary"
      : tone === "warn"
        ? "text-warn"
        : tone === "deny"
          ? "text-deny"
          : "text-foreground";
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className={toneClass}>{icon}</span>
      <div>
        <div className={`mono text-lg font-semibold ${toneClass}`}>
          {value.toLocaleString()}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}
