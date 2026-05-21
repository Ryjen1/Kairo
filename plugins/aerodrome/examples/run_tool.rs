//! Runner that executes a Kairo plugin tool through the official Aomi SDK
//! test harness and prints the resulting `DynToolStart` envelope to stdout.
//!
//! This is the exact dispatch path the Aomi runtime uses internally: the
//! `aomi_sdk::testing::run_tool` helper calls `T::run_with_routes`, which
//! is the same entry point `aomi_async_tool_start` invokes via FFI.
//!
//! The web app spawns this binary so visitors can fire any of the five
//! plugin tools from the /aomi page and see the real envelope return.
//!
//! Usage:
//!   cargo run -p kairo-aerodrome --release --example run_tool -- \
//!     --name get_positions \
//!     --args '{"wallet":"0x742d35Cc6634C0532925a3b844Bc9e7595f0beB1"}'

use aomi_sdk::testing::{TestCtxBuilder, run_tool};
use kairo_aerodrome::__test_exports::{
    GetGaugeSignal, GetPolicy, GetPositions, GetReceipt, KairoAerodromeApp, ProposeAction,
};
use serde_json::{Value, json};

fn parse_args() -> (String, Value) {
    let mut tool: Option<String> = None;
    let mut args_json: Option<String> = None;
    let mut iter = std::env::args().skip(1);
    while let Some(flag) = iter.next() {
        match flag.as_str() {
            "--name" => tool = iter.next(),
            "--args" => args_json = iter.next(),
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
    (tool, args)
}

fn main() {
    let (tool, args) = parse_args();
    let app = KairoAerodromeApp;
    let ctx = TestCtxBuilder::new(&tool).build();

    let result: Result<Value, String> = match tool.as_str() {
        "get_positions" => run_tool::<GetPositions>(&app, args, ctx).map(|r| r.value),
        "get_gauge_signal" => run_tool::<GetGaugeSignal>(&app, args, ctx).map(|r| r.value),
        "get_policy" => run_tool::<GetPolicy>(&app, args, ctx).map(|r| r.value),
        "propose_action" => run_tool::<ProposeAction>(&app, args, ctx).map(|r| r.value),
        "get_receipt" => run_tool::<GetReceipt>(&app, args, ctx).map(|r| r.value),
        other => {
            // Mirror the SDK's "unknown tool" envelope so the UI can render
            // it uniformly.
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
        Ok(value) => json!({
            "status": "ready",
            "result": { "Ok": value },
            "tool": tool,
        }),
        Err(message) => json!({
            "status": "ready",
            "result": { "Err": message },
            "tool": tool,
        }),
    };

    println!("{}", envelope);
}
