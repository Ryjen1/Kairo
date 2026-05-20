//! Integration tests exercising every plugin tool through the real
//! Aomi SDK test harness.
//!
//! These tests prove three things at once:
//!   1. The plugin's `DynAomiTool` impls deserialize the same JSON the
//!      Aomi runtime would inject (`run_tool` uses the exact same
//!      `T::run_with_routes` codepath the FFI dispatcher uses).
//!   2. The plugin emits real HTTP calls (no mocks anywhere).
//!   3. The Kairo HTTP API responds with the shape the plugin and the
//!      Aomi-hosted agent expect.
//!
//! Prereq: a Kairo backend must be reachable. Defaults to
//! `http://localhost:3000`. Override with `KAIRO_API_URL` to point at
//! Vercel preview or production.
//!
//! Run:
//!   pnpm dev         # start the Kairo backend in another terminal
//!   cargo test -p kairo-aerodrome --test integration \
//!     -- --test-threads=1 --nocapture
//!
//! `--test-threads=1` keeps requests sequential so a single Next.js dev
//! server can compile each route lazily on first hit without choking. In
//! a built production deploy this isn't needed.

use aomi_sdk::testing::{TestCtxBuilder, run_tool};
use kairo_aerodrome::__test_exports::*;
use serde_json::{Value, json};

const DEMO_WALLET: &str = "0x742d35Cc6634C0532925a3b844Bc9e7595f0beB1";

fn skip_if_backend_unreachable() -> bool {
    let base = std::env::var("KAIRO_API_URL").unwrap_or_else(|_| "http://localhost:3000".into());
    let probe = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .unwrap()
        .get(format!("{base}/api/policies/{DEMO_WALLET}/steward"))
        .send();
    match probe {
        Ok(r) if r.status().is_success() => false,
        _ => {
            eprintln!(
                "skipping integration test: {base} is not responding. \
                 Start with `pnpm dev` or set KAIRO_API_URL."
            );
            true
        }
    }
}

#[test]
fn get_policy_round_trips_against_live_kairo() {
    if skip_if_backend_unreachable() {
        return;
    }
    let app = KairoAerodromeApp;
    let ctx = TestCtxBuilder::new("get_policy").build();
    let args = json!({ "wallet": DEMO_WALLET, "agent_id": "steward" });
    let ret = run_tool::<GetPolicy>(&app, args, ctx).expect("plugin tool returned error");
    let policy: Value = ret.value;

    assert_eq!(policy["wallet"], DEMO_WALLET.to_lowercase());
    assert_eq!(policy["agentId"], "steward");
    assert!(policy["mode"].is_string(), "policy.mode should be a string");
    assert!(
        policy["rules"]["maxSpendPerActionUsd"].is_number(),
        "policy.rules.maxSpendPerActionUsd missing"
    );
}

#[test]
fn get_positions_returns_array_shape() {
    if skip_if_backend_unreachable() {
        return;
    }
    let app = KairoAerodromeApp;
    let ctx = TestCtxBuilder::new("get_positions").build();
    let args = json!({ "wallet": DEMO_WALLET });
    let ret = run_tool::<GetPositions>(&app, args, ctx)
        .expect("get_positions plugin tool returned error");
    let body: Value = ret.value;

    assert!(
        body["positions"].is_array(),
        "expected positions[] in response, got {body:?}"
    );
}

#[test]
fn propose_action_within_policy_auto_approves() {
    if skip_if_backend_unreachable() {
        return;
    }
    let app = KairoAerodromeApp;
    let ctx = TestCtxBuilder::new("propose_action").build();
    let args = json!({
        "kind": "rebalance",
        "wallet": DEMO_WALLET,
        "summary": "Integration test: rebalance $200 with +5% APR uplift",
        "from_pool": "0xcDAC0d6c6C59727a65F871236188350531885C43",
        "to_pool": "0x4D69971CCd4A636c403a3C1B00c85e99bB9B5606",
        "amount_usd": 200.0,
        "projected_apr_delta_bps": 500u32,
        "projected_impermanent_loss_bps": 100u32,
    });
    let ret = run_tool::<ProposeAction>(&app, args, ctx)
        .expect("propose_action plugin tool returned error");
    let body: Value = ret.value;

    assert_eq!(
        body["status"], "auto_approved",
        "expected auto_approved within default policy, got {body:?}"
    );
    assert_eq!(body["executed"], true);
    assert!(
        body["receipt_url"].as_str().is_some(),
        "receipt_url should be a string"
    );
    assert!(
        body["receipt_url"]
            .as_str()
            .unwrap_or_default()
            .contains("/r/"),
        "receipt_url should be a /r/<hash> URL"
    );
}

#[test]
fn propose_action_over_cap_requires_user_approval() {
    if skip_if_backend_unreachable() {
        return;
    }
    let app = KairoAerodromeApp;
    let ctx = TestCtxBuilder::new("propose_action").build();
    let args = json!({
        "kind": "rebalance",
        "wallet": DEMO_WALLET,
        "summary": "Integration test: $5,000 rebalance - over default $250 cap",
        "from_pool": "0xcDAC0d6c6C59727a65F871236188350531885C43",
        "to_pool": "0x4D69971CCd4A636c403a3C1B00c85e99bB9B5606",
        "amount_usd": 5000.0,
        "projected_apr_delta_bps": 600u32,
        "projected_impermanent_loss_bps": 80u32,
    });
    let ret = run_tool::<ProposeAction>(&app, args, ctx)
        .expect("propose_action over-cap tool returned error");
    let body: Value = ret.value;

    assert_eq!(
        body["status"], "pending_user",
        "expected pending_user status, got {body:?}"
    );
    assert_eq!(body["executed"], false);
    let reason = body["reason"].as_str().unwrap_or_default();
    assert!(
        reason.contains("cap"),
        "expected cap-related reason, got `{reason}`"
    );
}

#[test]
fn validation_rejects_malformed_wallet() {
    // No backend call; pure plugin-side validation.
    let app = KairoAerodromeApp;
    let ctx = TestCtxBuilder::new("get_policy").build();
    let args = json!({ "wallet": "not-a-wallet", "agent_id": "steward" });
    let err = run_tool::<GetPolicy>(&app, args, ctx)
        .expect_err("malformed wallet should be rejected before any HTTP call");
    assert!(
        err.contains("0x-prefixed") || err.contains("wallet"),
        "expected wallet validation error, got `{err}`"
    );
}

#[test]
fn validation_rejects_unknown_kind() {
    let app = KairoAerodromeApp;
    let ctx = TestCtxBuilder::new("propose_action").build();
    let args = json!({
        "kind": "fly_to_mars",
        "wallet": DEMO_WALLET,
        "summary": "I would like to fly to Mars",
    });
    let err = run_tool::<ProposeAction>(&app, args, ctx)
        .expect_err("unknown kind should be rejected before any HTTP call");
    assert!(
        err.contains("kind must be one of") || err.contains("fly_to_mars"),
        "expected kind validation error, got `{err}`"
    );
}
