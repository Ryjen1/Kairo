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
  ShieldCheck,
  Sparkles,
  Terminal,
  XCircle,
  Zap,
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

        {/* Streaming terminal */}
        <section className="mx-auto max-w-3xl pb-10">
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  kairo-aerodrome.so · live trace
                </span>
              </div>
              <div className="flex items-center gap-3">
                {status === "streaming" && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] text-primary">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    streaming
                  </span>
                )}
                {status === "ok" && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                    <CheckCircle2 className="h-3 w-3" /> done
                  </span>
                )}
                {status === "err" && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-deny">
                    <AlertCircle className="h-3 w-3" /> error
                  </span>
                )}
                {stages.length > 0 && status !== "streaming" && (
                  <button
                    onClick={reset}
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    reset
                  </button>
                )}
              </div>
            </div>

            <div
              ref={terminalRef}
              className="h-[400px] overflow-y-auto bg-surface-2/40 p-5 font-mono text-[11px] leading-relaxed"
            >
              {stages.length === 0 && status === "idle" && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <ShieldCheck className="h-6 w-6 opacity-30" />
                  <p>Pick a scenario above to dispatch through the real SDK.</p>
                </div>
              )}

              {stages.map((s, i) => (
                <StageLine key={i} event={s} />
              ))}

              {status === "streaming" && (
                <div className="mt-2 text-muted-foreground">
                  <span className="inline-block h-3 w-1.5 animate-pulse bg-primary" />
                </div>
              )}
            </div>

            {/* Receipt banner */}
            {receipt && (
              <div className="border-t border-border/50 bg-primary/5 px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="text-foreground">Receipt minted</span>
                    {receipt.status && (
                      <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                        {receipt.status.replace(/_/g, " ")}
                      </span>
                    )}
                    <span className="mono text-xs text-muted-foreground">
                      {receipt.hash.slice(0, 10)}…{receipt.hash.slice(-6)}
                    </span>
                  </div>
                  <a
                    href={receipt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-emerald-glow"
                  >
                    View receipt
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {receipt.reason && (
                  <p className="mt-2 text-xs text-muted-foreground">
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

function StageLine({ event }: { event: StageEvent }) {
  const stage = String(event.stage ?? "");
  const message = String(event.message ?? "");
  const t = typeof event.t === "number" ? event.t : null;
  const elapsed = typeof event.elapsed_ms === "number" ? event.elapsed_ms : null;
  const status = typeof event.status === "number" ? event.status : null;

  // Tone the line based on stage
  const tone: "primary" | "warn" | "deny" | "neutral" | "muted" = (() => {
    if (stage === "policy.decision") {
      const decisionStatus = String(event["status"] ?? "");
      if (decisionStatus === "auto_approved") return "primary";
      if (decisionStatus === "pending_user") return "warn";
      if (decisionStatus.startsWith("denied")) return "deny";
      return "neutral";
    }
    if (stage === "tool.ok" || stage === "runner.done") return "primary";
    if (stage.endsWith(".failed") || event.level === "ERROR") return "deny";
    if (stage === "scenario.start") return "neutral";
    if (stage === "http.send" || stage === "http.recv") return "muted";
    if (stage.startsWith("tool.") || stage.startsWith("runner.") || stage === "args.ok") {
      return "neutral";
    }
    return "muted";
  })();

  const toneClass = {
    primary: "text-primary",
    warn: "text-warn",
    deny: "text-deny",
    neutral: "text-foreground",
    muted: "text-muted-foreground",
  }[tone];

  // Build a compact fields suffix for the interesting numeric fields
  const fieldsList: string[] = [];
  if (elapsed !== null) fieldsList.push(`${elapsed}ms`);
  if (status !== null) fieldsList.push(`HTTP ${status}`);
  if (typeof event.method === "string" && typeof event.url === "string") {
    fieldsList.push(`${event.method} ${shortenUrl(event.url)}`);
  }
  if (typeof event.tool === "string" && stage.startsWith("tool.")) {
    fieldsList.push(`tool=${event.tool}`);
  }
  if (typeof event.bytes === "number") fieldsList.push(`${event.bytes}B`);
  const suffix = fieldsList.length > 0 ? `  · ${fieldsList.join(" · ")}` : "";

  return (
    <div className={`${toneClass} animate-fade-in`}>
      <span className="text-muted-foreground/60">
        {t !== null ? `+${String(t).padStart(4)}ms ` : "       "}
      </span>
      <span className="text-muted-foreground/80">{stage || event.level || "·"}</span>
      <span className="text-muted-foreground/60"> › </span>
      <span>{message}</span>
      <span className="text-muted-foreground/60">{suffix}</span>
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
