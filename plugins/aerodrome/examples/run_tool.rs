//! Runner that executes a Kairo plugin tool through the official Aomi SDK
//! test harness and prints the resulting `DynToolStart` envelope to stdout.
//!
//! This is the exact dispatch path the Aomi runtime uses internally: the
//! `aomi_sdk::testing::run_tool` helper calls `T::run_with_routes`, which
//! is the same entry point `aomi_async_tool_start` invokes via FFI.
//!
//! The web app spawns this binary in two modes:
//!   - The `/aomi` page (and the legacy `/api/aomi/run-tool` route) parse
//!     **stdout** as a single-line `DynToolStart` envelope.
//!   - The live-demo SSE route at `/api/demo/stream` also reads **stderr**,
//!     where `tracing` emits one JSON event per line as the dispatch makes
//!     progress (args validated, HTTP sent, response decoded, policy
//!     decision, etc).
//!
//! Pass `--trace` to enable the stderr event stream. Default off so the
//! existing `/aomi` route doesn't see extra output.
//!
//! Usage:
//!   cargo run -p kairo-aerodrome --release --example run_tool -- \
//!     --name get_positions \
//!     --args '{"wallet":"0x742d35Cc6634C0532925a3b844Bc9e7595f0beB1"}' \
//!     --trace

use aomi_sdk::testing::{TestCtxBuilder, run_tool};
use kairo_aerodrome::__test_exports::{
    GetGaugeSignal, GetPolicy, GetPositions, GetReceipt, KairoAerodromeApp, ProposeAction,
};
use serde_json::{Value, json};
use tracing::info;
use tracing_subscriber::{EnvFilter, fmt};

struct Args {
    tool: String,
    args: Value,
    trace: bool,
}

fn parse_args() -> Args {
    let mut tool: Option<String> = None;
    let mut args_json: Option<String> = None;
    let mut trace = false;
    let mut iter = std::env::args().skip(1);
    while let Some(flag) = iter.next() {
        match flag.as_str() {
            "--name" => tool = iter.next(),
            "--args" => args_json = iter.next(),
            "--trace" => trace = true,
            other => {
                eprintln!("unknown flag: {other}");
                std::process::exit(2);
            }
        }
    }
    let tool = tool.expect("--name <tool> required");
    let args: Value = args_json
        .as_deref()
        .map(|s| serde_json::from_str(s).expect("--args is not valid JSON"))
        .unwrap_or_else(|| json!({}));
    Args { tool, args, trace }
}

/// Initialise tracing-subscriber to emit one JSON event per line to stderr.
///
/// We use `with_writer(std::io::stderr)` so stdout stays clean for the
/// final envelope. The `compact_json` flatten lets the SSE route parse
/// each line as a self-contained JSON object.
fn init_tracing() {
    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,kairo_aerodrome=info")),
        )
        .with_writer(std::io::stderr)
        .with_ansi(false)
        .with_target(false)
        .with_file(false)
        .with_line_number(false)
        .with_thread_ids(false)
        .with_thread_names(false)
        .json()
        .flatten_event(true)
        .init();
}

fn main() {
    let parsed = parse_args();
    if parsed.trace {
        init_tracing();
        info!(
            stage = "runner.start",
            tool = %parsed.tool,
            "loaded kairo-aerodrome cdylib via aomi-sdk test harness"
        );
    }

    let app = KairoAerodromeApp;
    let ctx = TestCtxBuilder::new(&parsed.tool).build();

    let result: Result<Value, String> = match parsed.tool.as_str() {
        "get_positions" => run_tool::<GetPositions>(&app, parsed.args, ctx).map(|r| r.value),
        "get_gauge_signal" => run_tool::<GetGaugeSignal>(&app, parsed.args, ctx).map(|r| r.value),
        "get_policy" => run_tool::<GetPolicy>(&app, parsed.args, ctx).map(|r| r.value),
        "propose_action" => run_tool::<ProposeAction>(&app, parsed.args, ctx).map(|r| r.value),
        "get_receipt" => run_tool::<GetReceipt>(&app, parsed.args, ctx).map(|r| r.value),
        other => {
            // Mirror the SDK's "unknown tool" envelope so the UI can render
            // it uniformly.
            if parsed.trace {
                info!(stage = "runner.unknown_tool", tool = %other, "no such tool");
            }
            let envelope = json!({
                "status": "ready",
                "result": { "Err": format!("unknown tool: {other}") },
                "tool": other,
            });
            println!("{}", envelope);
            return;
        }
    };

    // Wrap the tool's typed return into the same DynToolStart-shaped envelope
    // the runtime would emit. This keeps the /aomi page's renderer simple.
    let envelope = match result {
        Ok(value) => {
            if parsed.trace {
                info!(stage = "runner.done", outcome = "ok", "tool finished successfully");
            }
            json!({
                "status": "ready",
                "result": { "Ok": value },
                "tool": parsed.tool,
            })
        }
        Err(message) => {
            if parsed.trace {
                info!(
                    stage = "runner.done",
                    outcome = "err",
                    error = %message,
                    "tool returned an error"
                );
            }
            json!({
                "status": "ready",
                "result": { "Err": message },
                "tool": parsed.tool,
            })
        }
    };

    println!("{}", envelope);
}
