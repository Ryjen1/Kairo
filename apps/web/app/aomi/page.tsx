import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  ExternalLink,
  FileCheck2,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { AomiRunToolPanel } from "@/components/AomiRunToolPanel";
import manifest from "@/lib/aomi-manifest.json";

export const metadata = {
  title: "Kairo · Aomi runtime plugin",
  description:
    "Verifiable proof that Kairo's Aerodrome agent ships as a native Aomi runtime plugin: the manifest the LLM consumes, the five typed tools, and the dlopen test that exercises the exact C ABI the runtime uses.",
};

interface ManifestTool {
  app: string;
  description: string;
  name: string;
  parameters_schema: {
    properties?: Record<string, { description?: string; type?: string }>;
    required?: string[];
    [k: string]: unknown;
  };
  supports_async: boolean;
}

interface AomiManifest {
  name: string;
  namespaces: string[];
  preamble: string;
  sdk_version: string;
  tools: ManifestTool[];
  version: string;
}

// TS infers narrow literal types from the imported JSON; cast through
// `unknown` so the loose `ManifestTool` shape applies cleanly to every entry.
const m = manifest as unknown as AomiManifest;

export default function AomiPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="grid-pattern pointer-events-none absolute inset-0 opacity-30" />

      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/arena"
              className="hidden rounded-lg px-3.5 py-2 font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
            >
              Arena
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-emerald-glow hover:shadow-glow-sm"
            >
              Open dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="container relative animate-fade-in py-12">
        {/* ────────────── Hero ────────────── */}
        <section className="mx-auto max-w-3xl pb-12">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-primary">
            aomi runtime · native plugin
          </p>
          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            Kairo ships as a real{" "}
            <span className="text-primary">Aomi plugin</span> — compiled,
            loaded, and verified.
          </h1>
          <p className="mt-4 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            The Aerodrome Steward isn&apos;t a chatbot wrapper. It&apos;s a
            native Aomi runtime cdylib built against{" "}
            <span className="font-mono text-foreground">
              aomi-sdk v{m.sdk_version}
            </span>{" "}
            from{" "}
            <a
              href="https://github.com/aomi-labs/aomi-sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-primary/40 underline-offset-4 hover:text-primary"
            >
              aomi-labs/aomi-sdk
            </a>
            . Five typed tools, hot-loadable, end-to-end verifiable.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Badge>
              <Cpu className="h-3.5 w-3.5" />
              {m.name} v{m.version}
            </Badge>
            <Badge>
              <FileCheck2 className="h-3.5 w-3.5" />
              {m.tools.length} typed tools
            </Badge>
            <Badge>
              <ShieldCheck className="h-3.5 w-3.5" />
              aomi-sdk v{m.sdk_version}
            </Badge>
            <Badge>
              <Terminal className="h-3.5 w-3.5" />
              cdylib · dlopen-verified
            </Badge>
          </div>
        </section>

        {/* ────────────── Tools ────────────── */}
        <section className="mx-auto max-w-5xl pb-12">
          <h2 className="mb-1 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            tools the llm sees
          </h2>
          <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
            When the Aomi runtime loads our plugin, it calls{" "}
            <span className="mono text-foreground">aomi_manifest()</span> and
            feeds these five tool schemas to the LLM. Each one wraps a typed
            agentic action gated by the on-chain Kairo policy.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {m.tools.map((t) => (
              <ToolCard key={t.name} tool={t} />
            ))}
          </div>
        </section>

        {/* ────────────── Live SDK demo ────────────── */}
        <section className="mx-auto max-w-5xl pb-12">
          <h2 className="mb-1 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            live demo
          </h2>
          <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
            Run any of the five plugin tools straight from the browser. Each
            click spawns the{" "}
            <span className="mono text-foreground">run_tool</span> example
            binary, which invokes{" "}
            <span className="mono text-foreground">
              aomi_sdk::testing::run_tool
            </span>{" "}
            against the compiled cdylib — the exact dispatch path the Aomi
            runtime uses internally. The envelope below is whatever the SDK
            returns.
          </p>
          <AomiRunToolPanel />
        </section>

        {/* ────────────── Architecture ────────────── */}
        <section className="mx-auto max-w-3xl pb-12">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            how it plugs in
          </h2>
          <div className="glass-card overflow-hidden">
            <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-muted-foreground">
{`Aomi runtime (host process)
    │
    │  dlopen() ── loads libkairo_aerodrome.so
    ▼
libkairo_aerodrome.so      ← Rust cdylib, this plugin
    │  exports the C ABI:
    │    aomi_create / aomi_destroy
    │    aomi_manifest
    │    aomi_async_tool_start / aomi_dyn_exec_poll
    │    aomi_free_string / aomi_sdk_version
    │
    │  reqwest::blocking → HTTPS
    ▼
Kairo HTTP API (Next.js · Vercel)
    │
    ├─ policy engine evaluates every proposal
    │       ▲
    │       │  wagmi useReadContract
    ├─ `+'`'+`KairoPolicy.sol`+'`'+` on Base Sepolia (`+'`'+`0xE080…B13A`+'`'+`)
    │
    └─ Aerodrome reads on Base mainnet (Voter, Gauge, Pool, Factory)`}
            </pre>
          </div>
        </section>

        {/* ────────────── Preamble ────────────── */}
        <section className="mx-auto max-w-3xl pb-12">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            preamble · what the runtime injects as system prompt
          </h2>
          <div className="glass-card overflow-hidden">
            <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-muted-foreground">
              {m.preamble}
            </pre>
          </div>
        </section>

        {/* ────────────── Evidence ────────────── */}
        <section className="mx-auto max-w-3xl pb-12">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            evidence · run it yourself
          </h2>
          <div className="space-y-3">
            <Evidence
              title="The plugin is a real cdylib"
              ok="ELF shared object, exports the seven Aomi FFI symbols the runtime dlopen()s"
              command={`cargo build -p kairo-aerodrome --release
file target/release/libkairo_aerodrome.so
nm -D --defined-only target/release/libkairo_aerodrome.so | grep aomi_`}
            />
            <Evidence
              title="The C ABI dispatch path works end-to-end"
              ok="5/5 dlopen runtime tests pass — same code path the Aomi runtime uses"
              command={`cargo test -p kairo-aerodrome --test test_runtime \\
  -- --test-threads=1 --nocapture`}
            />
            <Evidence
              title="Every tool routes to the real backend"
              ok="6/6 SDK harness integration tests pass against a live Kairo API"
              command={`pnpm dev    # in terminal 1
KAIRO_API_URL=http://localhost:3000 cargo test \\
  -p kairo-aerodrome --test integration \\
  -- --test-threads=1 --nocapture`}
            />
            <Evidence
              title="The policy is enforced on Base"
              ok={`KairoPolicy.sol deployed at 0xE080…B13A on Base Sepolia, 17/17 Foundry tests passing`}
              command={`cast call 0xE08065110d0d7E63582942447973f895bC35B13A \\
  "totalUpdates()(uint256)" \\
  --rpc-url https://sepolia.base.org`}
              href="https://sepolia.basescan.org/address/0xE08065110d0d7E63582942447973f895bC35B13A"
              hrefLabel="Open on Basescan"
            />
          </div>
        </section>

        {/* ────────────── Manifest JSON ────────────── */}
        <section className="mx-auto max-w-4xl pb-16">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            full manifest JSON
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Captured verbatim from a live{" "}
            <span className="mono text-foreground">aomi_manifest()</span> call
            against our compiled cdylib. This is exactly what the production
            Aomi runtime would hand to the LLM after hot-loading the plugin
            from a GitHub Release.
          </p>
          <div className="glass-card overflow-hidden">
            <pre className="max-h-[500px] overflow-auto p-5 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {JSON.stringify(m, null, 2)}
            </pre>
          </div>
        </section>

        <footer className="mx-auto max-w-3xl border-t border-border/50 pt-8 text-sm text-muted-foreground">
          <p>
            Code:{" "}
            <a
              href="https://github.com/Ryjen1/Kairo/tree/main/plugins/aerodrome"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-primary"
            >
              github.com/Ryjen1/Kairo/plugins/aerodrome
            </a>
            <span className="mx-2 text-border">·</span>
            Upstream:{" "}
            <a
              href="https://github.com/aomi-labs/aomi-sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-primary"
            >
              aomi-labs/aomi-sdk
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Subcomponents                               */
/* -------------------------------------------------------------------------- */

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
      {children}
    </span>
  );
}

function ToolCard({ tool }: { tool: ManifestTool }) {
  const params = tool.parameters_schema?.properties ?? {};
  const required = new Set(tool.parameters_schema?.required ?? []);
  const paramNames = Object.keys(params);

  return (
    <div className="glass-card p-5 transition-colors hover:border-primary/30">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-mono text-sm font-semibold text-foreground">
          {tool.name}
        </h3>
        <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
          {tool.supports_async ? "async" : "sync"}
        </span>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        {tool.description}
      </p>
      {paramNames.length > 0 && (
        <div className="border-t border-border/50 pt-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            parameters
          </div>
          <ul className="space-y-1.5">
            {paramNames.map((name) => {
              const p = params[name];
              const isReq = required.has(name);
              return (
                <li key={name} className="flex items-baseline gap-2 text-xs">
                  <span className="font-mono text-foreground">{name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {p?.type}
                  </span>
                  {isReq && (
                    <span className="rounded-sm bg-warn/15 px-1 text-[9px] uppercase text-warn">
                      required
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Evidence({
  title,
  ok,
  command,
  href,
  hrefLabel,
}: {
  title: string;
  ok: string;
  command: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-primary">
            <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>{ok}</span>
          </p>
        </div>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-secondary px-2.5 py-1 text-[11px] text-foreground hover:bg-surface-3"
          >
            {hrefLabel ?? "Open"}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <pre className="mt-3 overflow-x-auto bg-surface-2/50 p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {command}
      </pre>
    </div>
  );
}
