import path from "node:path";
import { spawn } from "node:child_process";
import { getOrCreatePolicy, upsertPolicy } from "@/lib/storage";

/**
 * `GET /api/demo/stream?scenario=a|b|c`
 *
 * Server-Sent Events endpoint that drives the live SDK demo. Pipes one
 * event per real boundary in the Rust plugin's dispatch path so the
 * browser can render a streaming terminal that mirrors what the Aomi
 * runtime sees when it loads our cdylib.
 *
 * The wire shape (one `event: <name>\ndata: <json>\n\n` block per emit):
 *
 *   event: scenario   data: { id, intent, label, expectedStatus }
 *   event: stage      data: { stage, message, t, fields... }   (many)
 *   event: result     data: { envelope: DynToolStart }
 *   event: receipt    data: { hash, url, status, reason }
 *   event: done       data: { ok, exitCode }
 *
 * Behind the scenes:
 *   1. Resolve the scenario into a typed Args object
 *   2. For Scenario C, tighten the wallet's poolAllowlist so the
 *      add-liquidity proposal will be caught by policy (and restore
 *      after the run so re-running is idempotent)
 *   3. Spawn the compiled run_tool binary with --trace
 *   4. Parse each JSON line on stderr and forward as a `stage` event
 *   5. Parse stdout (single line) as the envelope, surface as `result`
 *   6. Extract receipt hash + url, surface as `receipt`
 *   7. Close with `done`
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f0beB1";
const POOL_WETH_USDC = "0xcDAC0d6c6C59727a65F871236188350531885C43";
const POOL_USDC_USDBC = "0x4D69971CCd4A636c403a3C1B00c85e99bB9B5606";
const POOL_NOT_ALLOWLISTED = "0x1111111111111111111111111111111111111111";

interface Scenario {
  id: "a" | "b" | "c";
  label: string;
  intent: string;
  expectedStatus: "auto_approved" | "pending_user" | "denied_by_policy";
  args: Record<string, unknown>;
  tightenAllowlist: boolean;
}

const SCENARIOS: Record<string, Scenario> = {
  a: {
    id: "a",
    label: "Within policy",
    intent: "Move $200 from vAMM-WETH/USDC to sAMM-USDC/USDbC with +5.2% APR uplift.",
    expectedStatus: "auto_approved",
    args: {
      kind: "rebalance",
      wallet: DEMO_WALLET,
      summary: "Move $200 from vAMM-WETH/USDC to sAMM-USDC/USDbC (+5.2% APR)",
      from_pool: POOL_WETH_USDC,
      to_pool: POOL_USDC_USDBC,
      amount_usd: 200,
      projected_apr_delta_bps: 520,
      projected_impermanent_loss_bps: 80,
    },
    tightenAllowlist: false,
  },
  b: {
    id: "b",
    label: "Over per-action cap",
    intent:
      "$1,500 rebalance — exceeds the wallet's $250 per-action cap. Should route to the user.",
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
    tightenAllowlist: false,
  },
  c: {
    id: "c",
    label: "Pool not allow-listed",
    intent:
      "Add $150 liquidity to a pool that's not on the wallet's allowlist. Policy should flag it.",
    expectedStatus: "denied_by_policy",
    args: {
      kind: "add_liquidity",
      wallet: DEMO_WALLET,
      summary: "Add $150 liquidity to an unknown pool",
      pool: POOL_NOT_ALLOWLISTED,
      amount_usd: 150,
    },
    tightenAllowlist: true,
  },
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("scenario");
  if (!id || !SCENARIOS[id]) {
    return new Response(
      `unknown scenario: ${id ?? "(missing)"}; expected a, b, or c`,
      { status: 400 },
    );
  }
  const scenario = SCENARIOS[id]!;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const startedAt = Date.now();

      function emit(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      // 1. Announce scenario
      emit("scenario", {
        id: scenario.id,
        label: scenario.label,
        intent: scenario.intent,
        expectedStatus: scenario.expectedStatus,
      });

      // 2. Scenario C needs the allowlist tightened so the proposal is denied.
      //    We do this from the server (uses Prisma directly) so the demo is
      //    self-contained and the browser doesn't need extra round-trips.
      let touchedPolicy = false;
      try {
        if (scenario.tightenAllowlist) {
          emit("stage", {
            stage: "policy.tighten",
            message: "tightening wallet poolAllowlist for scenario C",
            t: Date.now() - startedAt,
          });
          const policy = await getOrCreatePolicy(DEMO_WALLET, "steward");
          await upsertPolicy({
            ...policy,
            rules: {
              ...policy.rules,
              poolAllowlist: [POOL_WETH_USDC, POOL_USDC_USDBC],
            },
          });
          touchedPolicy = true;
        }
      } catch (err) {
        emit("stage", {
          stage: "policy.tighten.failed",
          message: `failed to tighten allowlist: ${(err as Error).message}`,
          t: Date.now() - startedAt,
        });
      }

      // 3. Resolve the runner binary path (workspace target/release dir)
      const repoRoot = path.resolve(process.cwd(), "..", "..");
      const runner = path.join(
        repoRoot,
        "target",
        "release",
        "examples",
        "run_tool",
      );

      const kairoApiUrl =
        process.env.KAIRO_API_URL ??
        process.env.NEXT_PUBLIC_APP_URL ??
        "http://localhost:3000";

      emit("stage", {
        stage: "runner.spawn",
        message: `spawning run_tool example binary with --trace`,
        runner: path.relative(repoRoot, runner),
        kairoApiUrl,
        t: Date.now() - startedAt,
      });

      // 4. Spawn the binary
      const child = spawn(
        runner,
        ["--name", "propose_action", "--args", JSON.stringify(scenario.args), "--trace"],
        {
          env: { ...process.env, KAIRO_API_URL: kairoApiUrl, RUST_LOG: "info" },
          cwd: repoRoot,
        },
      );

      let stdoutBuf = "";
      let stderrLineBuf = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBuf += chunk.toString("utf8");
      });

      // Stream stderr line-by-line as `stage` events, parsing each
      // tracing-subscriber JSON line and forwarding the structured payload.
      child.stderr.on("data", (chunk: Buffer) => {
        stderrLineBuf += chunk.toString("utf8");
        let nl = stderrLineBuf.indexOf("\n");
        while (nl >= 0) {
          const line = stderrLineBuf.slice(0, nl).trim();
          stderrLineBuf = stderrLineBuf.slice(nl + 1);
          nl = stderrLineBuf.indexOf("\n");
          if (!line) continue;

          let parsed: Record<string, unknown> | null = null;
          try {
            parsed = JSON.parse(line) as Record<string, unknown>;
          } catch {
            // Not JSON; surface as raw line.
            emit("stage", {
              stage: "raw",
              message: line,
              t: Date.now() - startedAt,
            });
            continue;
          }

          emit("stage", {
            t: Date.now() - startedAt,
            ...parsed,
          });
        }
      });

      child.on("error", (err) => {
        emit("stage", {
          stage: "runner.spawn.failed",
          message: `spawn failed: ${err.message}`,
          t: Date.now() - startedAt,
        });
      });

      child.on("close", async (code) => {
        // 5. Parse stdout envelope
        let envelope: unknown = null;
        const stdoutLine = stdoutBuf.trim().split("\n").pop() ?? "";
        try {
          envelope = JSON.parse(stdoutLine);
        } catch {
          /* leave null; emit raw below */
        }

        if (envelope) {
          emit("result", { envelope });

          // 6. Pull out receipt + url from the envelope and surface for the UI
          const okPayload =
            (envelope as { result?: { Ok?: unknown } }).result?.Ok ?? null;
          if (okPayload && typeof okPayload === "object") {
            const ok = okPayload as {
              full?: {
                receipt?: { hash?: string; status?: string };
                url?: string;
              };
              receipt_url?: string;
              reason?: string;
              status?: string;
            };
            const hash = ok.full?.receipt?.hash ?? null;
            const status = ok.full?.receipt?.status ?? ok.status ?? null;
            const reason = ok.reason ?? "";
            const u = ok.full?.url ?? ok.receipt_url ?? "";
            if (hash) {
              emit("receipt", {
                hash,
                status,
                reason,
                url: u && u.startsWith("http") ? u : `/r/${hash}`,
              });
            }
          }
        } else if (stdoutLine) {
          emit("stage", {
            stage: "stdout.unparsed",
            message: stdoutLine.slice(0, 400),
            t: Date.now() - startedAt,
          });
        }

        // 7. Reset allowlist if we tightened it
        if (touchedPolicy) {
          try {
            const policy = await getOrCreatePolicy(DEMO_WALLET, "steward");
            await upsertPolicy({
              ...policy,
              rules: { ...policy.rules, poolAllowlist: [] },
            });
            emit("stage", {
              stage: "policy.relax",
              message: "allowlist restored to default (empty)",
              t: Date.now() - startedAt,
            });
          } catch {
            /* best-effort */
          }
        }

        emit("done", {
          ok: code === 0,
          exitCode: code,
          totalMs: Date.now() - startedAt,
        });
        controller.close();
      });
    },

    cancel() {
      /* client disconnected; child will be GC'd via its own close handler */
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
