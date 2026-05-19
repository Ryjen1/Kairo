# Kairo MCP Server

Lets any [Model Context Protocol](https://modelcontextprotocol.io)-compatible AI agent — Claude Desktop, Cursor, Claude Code, ElizaOS, OpenClaw, Nanobot, Continue — use Kairo as a safety + intelligence layer for Aerodrome actions.

## What it does

Five tools exposed to the agent:

| Tool | What it returns |
|---|---|
| `get_aerodrome_positions` | Live LP positions for a wallet (pool, USD value, gauge, earned AERO) |
| `get_gauge_signal` | Vote-weight share + reward rate + estimated APR for a list of pools |
| `check_policy` | Submits a proposed action and returns the policy decision *without executing* |
| `get_policy` | Reads the current policy (mode, caps, allowlists, Aerodrome rules) for a wallet |
| `get_receipt` | Fetches a Kairo receipt by hash |

The agent never sees private keys. It sees only typed reads and policy decisions.

## Why this matters

Most "agents that trade" wrap LLMs around raw RPC calls. That's how funds get burned. With Kairo MCP, an agent's flow becomes:

```
plan → check_policy → simulate → ask user (if needed) → execute
```

Where `check_policy` is a single tool call that asks Kairo: *"would this action be allowed under the user's leash?"* before the agent commits to broadcasting anything.

## Configure in Claude Desktop / Cursor

Add to your MCP config:

```json
{
  "mcpServers": {
    "kairo": {
      "command": "pnpm",
      "args": ["--filter", "@kairo/mcp", "start"],
      "cwd": "/path/to/kairo",
      "env": {
        "KAIRO_API_URL": "https://kairo.dev",
        "BASE_RPC_URL": "https://mainnet.base.org"
      }
    }
  }
}
```

Restart your agent. It now has five Kairo tools available.

## Example agent interactions

Once connected, an agent can:

> **User**: "Check whether my Steward would be allowed to rebalance $200 from WETH/USDC into USDC/USDbC right now."
>
> **Agent** (calling `get_policy` then `check_policy`): "Your policy currently allows actions up to $250 per move with min APR delta 4%. The proposed rebalance has a +5.2% projected APR delta — it would auto-approve."

Or:

> **User**: "Find the highest-APR pool in my position set and tell me what Steward would do."
>
> **Agent** (calling `get_aerodrome_positions`, then `get_gauge_signal` on each pool, then `check_policy`): "Your sAMM-USDC/USDbC has the highest estimated APR (17.5%). A rebalance from your WETH/USDC (12.3%) would clear policy — Kairo would auto-approve a $200 move."

## Why expose this

Kairo isn't trying to be the only agent on Base. We want **every agent that needs to act on Aerodrome** to be able to ask Kairo "is this allowed?" before acting. The leash should be portable.

The MCP server makes Kairo's policy + intelligence usable by:
- Coding assistants (Cursor, Claude Code) building agent workflows
- Local agents (ElizaOS, OpenClaw) that need a policy check before broadcasting
- Custom bots wanting to use Kairo's gauge signal without rebuilding it
