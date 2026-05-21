import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

/**
 * `POST /api/aomi/run-tool`
 *
 * Dispatches a tool through the Aomi SDK against our compiled plugin.
 *
 * The handler shells out to the `run_tool` example binary in
 * `plugins/aerodrome/examples/run_tool.rs`. That binary uses
 * `aomi_sdk::testing::run_tool` — the same code path the production
 * Aomi runtime uses internally to invoke a `DynAomiTool`. We then
 * forward the resulting `DynToolStart` envelope back to the caller.
 *
 * This is the live, browser-visible demonstration that our plugin
 * works through the real Aomi SDK dispatch contract.
 */

interface Body {
  name: string;
  args: unknown;
}

const ALLOWED_TOOLS = new Set([
  "get_positions",
  "get_gauge_signal",
  "get_policy",
  "propose_action",
  "get_receipt",
]);

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch (err) {
    return NextResponse.json(
      { error: `invalid JSON body: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  if (typeof body.name !== "string" || !ALLOWED_TOOLS.has(body.name)) {
    return NextResponse.json(
      {
        error: `unknown tool: ${body.name}. Allowed: ${[...ALLOWED_TOOLS].join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Pretty-print the args as a single-line JSON string for the CLI.
  const argsJson = JSON.stringify(body.args ?? {});

  // The runner lives at <repo-root>/target/release/examples/run_tool.
  // The web app runs from <repo-root>/apps/web; walk up two parents to
  // reach the workspace root.
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const runner = path.join(repoRoot, "target", "release", "examples", "run_tool");

  // KAIRO_API_URL defaults to the running web app so every tool call
  // routes back to /api/* on the same dev server. Override via env if
  // you want to point the demo at a different backend.
  const kairoApiUrl =
    process.env.KAIRO_API_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const started = Date.now();
  try {
    const { stdout } = await execFileAsync(
      runner,
      ["--name", body.name, "--args", argsJson],
      {
        env: { ...process.env, KAIRO_API_URL: kairoApiUrl },
        timeout: 25_000,
        maxBuffer: 4 * 1024 * 1024,
        cwd: repoRoot,
      },
    );
    const tookMs = Date.now() - started;
    const envelope = JSON.parse(stdout);
    return NextResponse.json({
      envelope,
      meta: {
        tookMs,
        runner: path.relative(repoRoot, runner),
        kairoApiUrl,
        dispatchPath:
          "aomi_sdk::testing::run_tool → T::run_with_routes → DynAomiTool::run",
      },
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
    };
    // If the binary is missing, fall back with a clear hint.
    if (e.code === "ENOENT") {
      return NextResponse.json(
        {
          error:
            "Plugin runner not built. Run `cargo build -p kairo-aerodrome --release --example run_tool` from the repo root.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        error: `plugin dispatch failed: ${e.message}`,
        stdout: e.stdout,
        stderr: e.stderr,
      },
      { status: 500 },
    );
  }
}
