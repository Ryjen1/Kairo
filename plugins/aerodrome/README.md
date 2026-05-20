# Kairo Aerodrome Plugin

A native [Aomi](https://aomi.dev) plugin that exposes Kairo's Aerodrome-LP
agent surface as five typed tools the Aomi runtime can call.

The plugin compiles to a cdylib (`libkairo_aerodrome.so` / `.dylib`) and is
hot-loaded by the Aomi runtime in production.

## What it exposes

| Tool | Purpose |
|---|---|
| `get_positions(wallet)` | Live Aerodrome LP positions on Base mainnet |
| `get_gauge_signal(pools)` | Vote-weighted APR + reward rate per pool from Aerodrome's Voter and Gauge contracts |
| `get_policy(wallet, agent_id)` | The user's current Kairo leash (mirrors `KairoPolicy.sol` on Base Sepolia) |
| `propose_action(...)` | Submit a typed proposal — Kairo simulates, checks against policy, returns a receipt |
| `get_receipt(hash)` | Fetch any past receipt with its decision, simulation, and rule trail |

Every tool wraps the live Kairo HTTP API. The plugin is a thin transport
layer; the policy engine, simulator, and on-chain registry reads live in
the Kairo backend. This keeps the plugin small (~8 MB optimized) and means
every Kairo product upgrade ships automatically without republishing a new
`.so` to the Aomi runtime.

## Architecture

```
Aomi runtime (host process)
    │
    │  dlopen() — hot-load
    ▼
libkairo_aerodrome.so (this plugin)
    │
    │  reqwest::blocking → HTTPS
    ▼
Kairo HTTP API (Next.js on Vercel)
    │
    ├─ policy engine evaluates against on-chain rules
    │      ▲
    │      │  reads via wagmi
    ├─ KairoPolicy.sol (Base Sepolia, 0xE08065110d0d7E63582942447973f895bC35B13A)
    │
    └─ simulation against Base mainnet
```

The plugin never holds private keys. The Aomi runtime + the user's wallet
do the signing. The plugin only proposes — Kairo decides — and returns a
receipt URL the agent reads back to the user.

## Persona-aware system prompt

The plugin ships a `PREAMBLE` tuned for **Mei**, the persona Kairo
targets: a part-time Aerodrome LP with ~$5k who wants yield without
checking gauges every Sunday. The preamble enforces the workflow:

1. Observe (`get_positions`)
2. Diagnose (`get_gauge_signal` on candidate pools)
3. Check the leash (`get_policy`)
4. Propose inside the leash (`propose_action`)
5. Report the receipt URL back

See `src/lib.rs` for the full preamble text.

## Build locally

Requires Rust 1.91+ (the workspace pin).

```bash
# From the repo root
cargo build -p kairo-aerodrome             # debug build
cargo build -p kairo-aerodrome --release   # produces target/release/libkairo_aerodrome.so
```

Run the SDK's CI checks before opening a PR:

```bash
cargo fmt -p kairo-aerodrome --check
cargo clippy -p kairo-aerodrome --lib -- -Dwarnings
cargo test -p kairo-aerodrome --no-run
```

## Configure

The plugin reads `KAIRO_API_URL` at tool-call time. If unset, it defaults to
`https://kairo.dev`.

```bash
# Point at a local Kairo backend
KAIRO_API_URL=http://localhost:3000 cargo build -p kairo-aerodrome --release
```

The Aomi runtime injects this env var when loading the plugin.

## Submit to the Aomi runtime

Per the [Aomi SDK publication pipeline](https://github.com/aomi-labs/aomi-sdk#publication-pipeline):

1. Open a PR adding this app crate to `aomi-labs/aomi-sdk` under `apps/kairo-aerodrome`
2. CI builds the cdylib for `x86_64-linux` and `aarch64-darwin`
3. On merge to `publish`, a tarball is attached to a GitHub Release
4. The Aomi runtime polls every 5 minutes and hot-loads the new plugin

For development, point a local Aomi runtime at this directory via the
`LOCAL_AOMI_APPS` environment variable documented in the SDK readme.

## File layout

```
plugins/aerodrome/
├── Cargo.toml
├── README.md
└── src/
    ├── lib.rs          # app manifest + preamble + tool registration
    ├── client.rs       # HTTP client + Aomi tool argument types
    └── tool.rs         # five DynAomiTool implementations
```

Standard Aomi app split, matching `sdk/examples/app-template-http`.
