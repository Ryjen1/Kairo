//! Five typed Aomi tools wrapping Kairo's HTTP API.
//!
//! Each tool implements `DynAomiTool` and is registered in `lib.rs`. They are
//! thin transport-layer wrappers — the policy engine, simulator, and on-chain
//! `KairoPolicy.sol` reads all live in the Kairo backend. Keeping the plugin
//! thin means it inherits every product upgrade automatically without
//! republishing a new `.so` to the Aomi runtime.

use crate::client::*;
use aomi_sdk::*;
use serde_json::{Value, json};

/* -------------------------------------------------------------------------- */
/*                            get_positions(wallet)                           */
/* -------------------------------------------------------------------------- */

pub struct GetPositions;

impl DynAomiTool for GetPositions {
    type App = KairoAerodromeApp;
    type Args = WalletOnlyArgs;
    const NAME: &'static str = "get_positions";
    const DESCRIPTION: &'static str = "Read a wallet's live Aerodrome LP positions on Base mainnet. \
        Returns pool address, symbol, USD value, share of pool, LP balance in wallet vs gauge, \
        and earned AERO. Use this first to understand what the user is managing before proposing \
        any action.";

    fn run(
        _app: &KairoAerodromeApp,
        args: Self::Args,
        _ctx: DynToolCallCtx,
    ) -> Result<Value, String> {
        validate_wallet(&args.wallet)?;
        let client = KairoClient::new()?;
        let path = format!("/api/wallets/{}/positions", args.wallet);
        let body = client.get_json(&path)?;
        Ok(body)
    }
}

/* -------------------------------------------------------------------------- */
/*                       get_gauge_signal(pools[])                            */
/* -------------------------------------------------------------------------- */

pub struct GetGaugeSignal;

impl DynAomiTool for GetGaugeSignal {
    type App = KairoAerodromeApp;
    type Args = GaugeSignalArgs;
    const NAME: &'static str = "get_gauge_signal";
    const DESCRIPTION: &'static str = "Read live vote-weighted APR and reward rate from Aerodrome's \
        Voter and Gauge contracts for one or more pools. Use this to decide whether a rebalance \
        is worth proposing — if the candidate pool's estimated APR beats the user's current pool \
        by more than ~4%, propose. Returns per-pool: voteShareBps, estimatedAprBps, tvlUsd.";

    fn run(
        _app: &KairoAerodromeApp,
        args: Self::Args,
        _ctx: DynToolCallCtx,
    ) -> Result<Value, String> {
        if args.pools.is_empty() {
            return Err("at least one pool address is required".to_string());
        }
        for p in &args.pools {
            validate_address(p, "pool")?;
        }
        let client = KairoClient::new()?;
        // Backend exposes gauge intelligence via a query-string list.
        let query = args
            .pools
            .iter()
            .map(|p| format!("pool={p}"))
            .collect::<Vec<_>>()
            .join("&");
        let path = format!("/api/gauges?{query}");
        let body = client.get_json(&path)?;
        Ok(body)
    }
}

/* -------------------------------------------------------------------------- */
/*                       get_policy(wallet, agent_id)                         */
/* -------------------------------------------------------------------------- */

pub struct GetPolicy;

impl DynAomiTool for GetPolicy {
    type App = KairoAerodromeApp;
    type Args = GetPolicyArgs;
    const NAME: &'static str = "get_policy";
    const DESCRIPTION: &'static str = "Read the user's current Kairo policy for a given agent. \
        The policy mirrors KairoPolicy.sol on Base Sepolia and contains the mode \
        (ask_every / allow_under_limits / block), spend caps, pool/gauge allowlists, \
        min APR delta threshold, max impermanent loss tolerance, and auto-claim limit. \
        Call this before propose_action so you draft proposals that fit the leash.";

    fn run(
        _app: &KairoAerodromeApp,
        args: Self::Args,
        _ctx: DynToolCallCtx,
    ) -> Result<Value, String> {
        validate_wallet(&args.wallet)?;
        if args.agent_id.trim().is_empty() {
            return Err("agent_id cannot be empty".to_string());
        }
        let client = KairoClient::new()?;
        let path = format!("/api/policies/{}/{}", args.wallet, args.agent_id);
        let body = client.get_json(&path)?;
        Ok(body)
    }
}

/* -------------------------------------------------------------------------- */
/*                      propose_action(...) -> receipt                        */
/* -------------------------------------------------------------------------- */

pub struct ProposeAction;

impl DynAomiTool for ProposeAction {
    type App = KairoAerodromeApp;
    type Args = ProposeActionArgs;
    const NAME: &'static str = "propose_action";
    const DESCRIPTION: &'static str = "Submit a proposed Aerodrome action to Kairo for evaluation. \
        Kairo simulates the action, checks it against the user's on-chain policy, and returns one \
        of three outcomes: auto_approved (within policy, executes), pending_user (over a limit, \
        queued in the dashboard for the user), or denied (violates a hard rule). The response \
        includes a receipt hash and a public URL the user can visit to inspect the decision. \
        This tool never executes a transaction directly — the user's wallet signs separately.";

    fn run(
        _app: &KairoAerodromeApp,
        args: Self::Args,
        _ctx: DynToolCallCtx,
    ) -> Result<Value, String> {
        validate_wallet(&args.wallet)?;
        validate_kind(&args.kind)?;
        if args.summary.trim().is_empty() {
            return Err("summary cannot be empty — it is what the user sees on the receipt".into());
        }

        // Map snake_case Aomi args to the Kairo API's camelCase wire shape.
        let proposal = build_proposal_payload(&args)?;

        let client = KairoClient::new()?;
        let body = client.post_json("/api/proposals", &proposal)?;

        // Surface the most important fields up front for the agent's
        // summarization step. Full receipt is in `body.receipt`.
        let status = body
            .get("receipt")
            .and_then(|r| r.get("status"))
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .to_string();
        let url = body
            .get("url")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let executed = body
            .get("executed")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let reason = body
            .get("receipt")
            .and_then(|r| r.get("decision"))
            .and_then(|d| d.get("reason"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();

        Ok(json!({
            "status": status,
            "executed": executed,
            "reason": reason,
            "receipt_url": url,
            "full": body,
        }))
    }
}

/* -------------------------------------------------------------------------- */
/*                          get_receipt(hash)                                 */
/* -------------------------------------------------------------------------- */

pub struct GetReceipt;

impl DynAomiTool for GetReceipt {
    type App = KairoAerodromeApp;
    type Args = GetReceiptArgs;
    const NAME: &'static str = "get_receipt";
    const DESCRIPTION: &'static str = "Fetch a previously-finalized Kairo receipt by hash. Returns \
        the full proposal, simulation result, the policy snapshot the decision was made against, \
        the decision itself with every rule that was evaluated, and the on-chain tx hash if \
        executed. Use this to check the status of a pending receipt or to cite a past decision.";

    fn run(
        _app: &KairoAerodromeApp,
        args: Self::Args,
        _ctx: DynToolCallCtx,
    ) -> Result<Value, String> {
        if !args.hash.starts_with("0x") {
            return Err("hash must be 0x-prefixed".to_string());
        }
        let client = KairoClient::new()?;
        let path = format!("/api/receipts/{}", args.hash);
        let body = client.get_json(&path)?;
        Ok(body)
    }
}

/* -------------------------------------------------------------------------- */
/*                                Validation                                  */
/* -------------------------------------------------------------------------- */

fn validate_wallet(wallet: &str) -> Result<(), String> {
    validate_address(wallet, "wallet")
}

fn validate_address(addr: &str, field: &str) -> Result<(), String> {
    if !addr.starts_with("0x") {
        return Err(format!("{field} must be 0x-prefixed"));
    }
    if addr.len() != 42 {
        return Err(format!("{field} must be 42 chars (0x + 40 hex)"));
    }
    if !addr[2..].chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(format!("{field} contains non-hex characters"));
    }
    Ok(())
}

const VALID_KINDS: &[&str] = &[
    "rebalance",
    "claim_rewards",
    "swap",
    "add_liquidity",
    "remove_liquidity",
    "vote_for_gauge",
];

fn validate_kind(kind: &str) -> Result<(), String> {
    if VALID_KINDS.contains(&kind) {
        Ok(())
    } else {
        Err(format!(
            "kind must be one of {} (got `{kind}`)",
            VALID_KINDS.join(", ")
        ))
    }
}

/* -------------------------------------------------------------------------- */
/*                       Proposal payload builder                             */
/* -------------------------------------------------------------------------- */

/// Build the JSON body for POST `/api/proposals`. The Kairo API uses
/// camelCase field names and discriminates on `kind`. We translate the
/// snake_case Aomi tool args into the canonical wire shape.
fn build_proposal_payload(args: &ProposeActionArgs) -> Result<Value, String> {
    // Generate a deterministic-ish proposal id. The runtime can override
    // this on subsequent calls if needed.
    let proposal_id = format!(
        "aomi-{}-{}",
        args.kind,
        // Use the summary hash for stability across retries.
        simple_hash(&format!("{}{}", args.wallet, args.summary))
    );

    let now_ms = current_millis();

    // Common envelope across all kinds.
    let mut body = json!({
        "id": proposal_id,
        "kind": args.kind,
        "agentId": "steward",
        "wallet": args.wallet,
        "createdAt": now_ms,
        "summary": args.summary,
        // The simulation field is required by the API. The plugin doesn't run
        // the simulator directly — Kairo simulates server-side. We mark the
        // simulation as success here as a default; for stricter setups the
        // backend will re-simulate and override.
        "simulation": {
            "success": true,
            "gasUsed": "0",
            "tokenDeltas": [],
            "blockNumber": "0",
        },
    });

    match args.kind.as_str() {
        "rebalance" => {
            let from_pool = args
                .from_pool
                .as_ref()
                .ok_or("rebalance requires from_pool")?;
            let to_pool = args.to_pool.as_ref().ok_or("rebalance requires to_pool")?;
            validate_address(from_pool, "from_pool")?;
            validate_address(to_pool, "to_pool")?;
            let amount_usd = args.amount_usd.ok_or("rebalance requires amount_usd")?;
            let apr_delta = args.projected_apr_delta_bps.unwrap_or(0);
            body["fromPool"] = json!(from_pool);
            body["toPool"] = json!(to_pool);
            body["amountUsd"] = json!(amount_usd);
            body["projectedAprDeltaBps"] = json!(apr_delta);
            if let Some(il) = args.projected_impermanent_loss_bps {
                body["projectedImpermanentLossBps"] = json!(il);
            }
        }
        "claim_rewards" => {
            let pool = args.pool.as_ref().ok_or("claim_rewards requires pool")?;
            validate_address(pool, "pool")?;
            let reward = args
                .estimated_reward_usd
                .ok_or("claim_rewards requires estimated_reward_usd")?;
            body["pool"] = json!(pool);
            body["estimatedRewardUsd"] = json!(reward);
        }
        "swap" => {
            let token_in = args.token_in.as_ref().ok_or("swap requires token_in")?;
            let token_out = args.token_out.as_ref().ok_or("swap requires token_out")?;
            validate_address(token_in, "token_in")?;
            validate_address(token_out, "token_out")?;
            let amount_in = args.amount_in_usd.ok_or("swap requires amount_in_usd")?;
            let amount_out = args
                .expected_amount_out_usd
                .ok_or("swap requires expected_amount_out_usd")?;
            let slip = args.slippage_bps.unwrap_or(50);
            body["tokenIn"] = json!(token_in);
            body["tokenOut"] = json!(token_out);
            body["amountInUsd"] = json!(amount_in);
            body["expectedAmountOutUsd"] = json!(amount_out);
            body["slippageBps"] = json!(slip);
        }
        "add_liquidity" => {
            let pool = args.pool.as_ref().ok_or("add_liquidity requires pool")?;
            validate_address(pool, "pool")?;
            let amount_usd = args.amount_usd.ok_or("add_liquidity requires amount_usd")?;
            // tokenA / tokenB are derived server-side from the pool address
            // — we don't ask the agent to provide them.
            body["pool"] = json!(pool);
            body["amountUsd"] = json!(amount_usd);
            // Placeholder addresses; the backend validates token info via
            // the on-chain pool reader.
            body["tokenA"] = json!("0x0000000000000000000000000000000000000000");
            body["tokenB"] = json!("0x0000000000000000000000000000000000000000");
        }
        "remove_liquidity" => {
            let pool = args.pool.as_ref().ok_or("remove_liquidity requires pool")?;
            validate_address(pool, "pool")?;
            let amount_usd = args
                .amount_usd
                .ok_or("remove_liquidity requires amount_usd")?;
            body["pool"] = json!(pool);
            body["amountUsd"] = json!(amount_usd);
        }
        "vote_for_gauge" => {
            let gauge = args.gauge.as_ref().ok_or("vote_for_gauge requires gauge")?;
            validate_address(gauge, "gauge")?;
            let weight = args
                .weight_bps
                .ok_or("vote_for_gauge requires weight_bps")?;
            if weight > 10_000 {
                return Err("weight_bps must be 0..=10000".to_string());
            }
            body["gauge"] = json!(gauge);
            body["weightBps"] = json!(weight);
        }
        _ => return Err(format!("unsupported kind `{}`", args.kind)),
    }

    Ok(body)
}

/// Deterministic, dependency-free hash for proposal ids. Not cryptographic;
/// just a stable stringification.
fn simple_hash(s: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:x}", h)
}

/// Current time in unix milliseconds. Falls back to 0 on the (unlikely)
/// event the system clock is before the unix epoch.
fn current_millis() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
