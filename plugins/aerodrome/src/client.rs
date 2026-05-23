use aomi_sdk::schemars::JsonSchema;
use serde::Deserialize;
use serde_json::Value;
use std::time::{Duration, Instant};
use tracing::info;

/// The Aomi app handle. Stateless — every tool call constructs a fresh
/// `KairoClient`. State lives in the Kairo backend, not here.
#[derive(Clone, Default)]
pub struct KairoAerodromeApp;

/// Default Kairo API base URL. Override at deploy time with the
/// `KAIRO_API_URL` environment variable so we can point at staging or local.
pub(crate) const DEFAULT_API_BASE: &str = "https://kairo.dev";

/// Wraps `reqwest::blocking` (per Aomi convention — plugins are sync) and
/// gives us `get_json` / `post_json` helpers tuned to the Kairo API.
#[derive(Clone)]
pub(crate) struct KairoClient {
    pub http: reqwest::blocking::Client,
    pub base: String,
}

impl KairoClient {
    pub fn new() -> Result<Self, String> {
        let http = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
            .map_err(|e| format!("failed to build HTTP client: {e}"))?;

        let base = std::env::var("KAIRO_API_URL").unwrap_or_else(|_| DEFAULT_API_BASE.to_string());

        Ok(Self { http, base })
    }

    pub fn get_json(&self, path: &str) -> Result<Value, String> {
        let url = format!("{}{}", self.base, path);
        info!(stage = "http.send", method = "GET", url = %url, "sending request to Kairo API");

        let started = Instant::now();
        let response = self
            .http
            .get(&url)
            .send()
            .map_err(|e| format!("kairo GET {url}: {e}"))?;

        let status = response.status();
        let elapsed_ms = started.elapsed().as_millis() as u64;
        info!(
            stage = "http.recv",
            status = status.as_u16(),
            elapsed_ms,
            "Kairo API responded"
        );

        let body = response.text().unwrap_or_default();
        if !status.is_success() {
            return Err(format!("kairo {url} -> {status}: {body}"));
        }

        info!(stage = "decode", bytes = body.len(), "decoding JSON response");
        serde_json::from_str(&body).map_err(|e| format!("kairo decode failed: {e}"))
    }

    pub fn post_json(&self, path: &str, body: &Value) -> Result<Value, String> {
        let url = format!("{}{}", self.base, path);
        let payload = serde_json::to_string(body).map_err(|e| format!("encode body: {e}"))?;
        info!(
            stage = "http.send",
            method = "POST",
            url = %url,
            bytes = payload.len(),
            "sending request to Kairo API"
        );

        let started = Instant::now();
        let response = self
            .http
            .post(&url)
            .header("content-type", "application/json")
            .body(payload)
            .send()
            .map_err(|e| format!("kairo POST {url}: {e}"))?;

        let status = response.status();
        let elapsed_ms = started.elapsed().as_millis() as u64;
        info!(
            stage = "http.recv",
            status = status.as_u16(),
            elapsed_ms,
            "Kairo API responded"
        );

        let text = response.text().unwrap_or_default();
        if !status.is_success() {
            return Err(format!("kairo {url} -> {status}: {text}"));
        }

        info!(stage = "decode", bytes = text.len(), "decoding JSON response");
        serde_json::from_str(&text).map_err(|e| format!("kairo decode failed: {e}"))
    }
}

/* -------------------------------------------------------------------------- */
/*                              Tool argument types                           */
/* -------------------------------------------------------------------------- */

/// Argument to `get_positions`.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct WalletOnlyArgs {
    /// EVM wallet address (0x-prefixed, 40 hex chars).
    pub wallet: String,
}

/// Argument to `get_gauge_signal`. Pass one or more pool addresses to read
/// live vote-weighted APR for each.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct GaugeSignalArgs {
    /// One or more Aerodrome pool contract addresses (0x-prefixed).
    pub pools: Vec<String>,
}

/// Argument to `get_policy`. Reads the leash for a (wallet, agent) pair.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct GetPolicyArgs {
    /// EVM wallet address (0x-prefixed).
    pub wallet: String,
    /// Agent identifier. Default to "steward" if the user hasn't installed
    /// a different agent — that's the only one Kairo ships in v1.
    #[serde(default = "default_agent_id")]
    pub agent_id: String,
}

fn default_agent_id() -> String {
    "steward".to_string()
}

/// Argument to `propose_action`. The shape mirrors Kairo's POST
/// `/api/proposals` body so the runtime forwards the agent's typed
/// proposal directly without re-encoding.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct ProposeActionArgs {
    /// Kind of action. One of: rebalance | claim_rewards | swap |
    /// add_liquidity | remove_liquidity | vote_for_gauge.
    pub kind: String,

    /// Wallet that owns this action.
    pub wallet: String,

    /// Human-readable one-line summary — surfaces in the receipt UI.
    pub summary: String,

    /// Source pool for a rebalance. Omit for non-rebalance actions.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_pool: Option<String>,

    /// Destination pool for a rebalance. Omit for non-rebalance actions.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_pool: Option<String>,

    /// Pool address (claim_rewards / add_liquidity / remove_liquidity).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pool: Option<String>,

    /// Gauge address (vote_for_gauge only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gauge: Option<String>,

    /// USD value of the action. Required for rebalance / add_liquidity /
    /// remove_liquidity. Kairo evaluates this against the spend cap.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amount_usd: Option<f64>,

    /// Projected APR delta in basis points (rebalance only). Kairo's policy
    /// engine checks this against the user's `minAprDeltaBps`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub projected_apr_delta_bps: Option<u32>,

    /// Projected impermanent loss in basis points (rebalance only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub projected_impermanent_loss_bps: Option<u32>,

    /// Estimated reward USD for claim_rewards.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub estimated_reward_usd: Option<f64>,

    /// Vote weight in basis points (vote_for_gauge only, 0-10000).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight_bps: Option<u32>,

    /// Token in (swap only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub token_in: Option<String>,
    /// Token out (swap only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub token_out: Option<String>,
    /// Amount in USD (swap only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amount_in_usd: Option<f64>,
    /// Expected amount out in USD (swap only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_amount_out_usd: Option<f64>,
    /// Slippage in basis points (swap only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slippage_bps: Option<u32>,
}

/// Argument to `get_receipt`. Fetch a previously-decided receipt by hash.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct GetReceiptArgs {
    /// Receipt hash (0x-prefixed, 32 bytes hex).
    pub hash: String,
}
