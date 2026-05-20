//! Runtime simulator: load our compiled `libkairo_aerodrome.so` via `dlopen`
//! and exercise the **exact C ABI** the Aomi runtime uses in production.
//!
//! This is the strongest local proof short of having the production Aomi
//! runtime hot-load our plugin from a GitHub Release. Every symbol the
//! runtime calls (`aomi_create`, `aomi_manifest`, `aomi_async_tool_start`,
//! `aomi_dyn_exec_poll`, `aomi_destroy`, `aomi_free_string`,
//! `aomi_sdk_version`) is invoked here the same way the runtime invokes it.
//!
//! Run:
//!   cargo build -p kairo-aerodrome --release
//!   cargo test  -p kairo-aerodrome --test test_runtime -- --nocapture
//!
//! These tests intentionally do not require a running backend — they
//! exercise the ABI and dispatch surface, not the HTTP round-trip. For
//! the HTTP round-trip with a live backend see `tests/integration.rs`.

use libloading::{Library, Symbol};
use serde_json::Value;
use std::ffi::{CStr, CString, c_char, c_void};
use std::path::PathBuf;
use std::sync::OnceLock;

// --- Real Aomi C ABI types -------------------------------------------------
// Lifted directly from vendor/aomi-sdk/sdk/src/ffi.rs to make the dispatch
// path completely transparent.

type AomiCreateFn = unsafe extern "C" fn() -> *mut c_void;
type AomiDestroyFn = unsafe extern "C" fn(*mut c_void);
type AomiManifestFn = unsafe extern "C" fn(*mut c_void) -> *mut c_char;
type AomiAsyncToolStartFn = unsafe extern "C" fn(
    instance: *mut c_void,
    name: *const c_char,
    args_json: *const c_char,
    ctx_json: *const c_char,
) -> *mut c_char;
type AomiExecPollFn = unsafe extern "C" fn(*mut c_void, u64) -> *mut c_char;
type AomiFreeStringFn = unsafe extern "C" fn(*mut c_char);
type AomiSdkVersionFn = unsafe extern "C" fn() -> *const c_char;

/// Resolve the path to the released cdylib.
///
/// CARGO_MANIFEST_DIR is `.../plugins/aerodrome`. The release artifact
/// lives two parents up at `.../target/release/libkairo_aerodrome.so`.
fn plugin_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|p| p.parent())
        .expect("CARGO_MANIFEST_DIR must have two parent directories")
        .join("target")
        .join("release")
        .join(format!(
            "{}kairo_aerodrome{}",
            std::env::consts::DLL_PREFIX,
            std::env::consts::DLL_SUFFIX,
        ))
}

/// Singleton plugin handle. The leaked `Library` keeps the symbols alive
/// for the entire test process — Rust's `Library` drops `dlclose`s, which
/// would invalidate every `Symbol` we still hold.
struct LoadedPlugin {
    /// We never read this field; it's only stored so the `Library` lives.
    _lib: &'static Library,
    instance: *mut c_void,
    create: Symbol<'static, AomiCreateFn>,
    destroy: Symbol<'static, AomiDestroyFn>,
    manifest: Symbol<'static, AomiManifestFn>,
    async_start: Symbol<'static, AomiAsyncToolStartFn>,
    exec_poll: Symbol<'static, AomiExecPollFn>,
    free_string: Symbol<'static, AomiFreeStringFn>,
    sdk_version: Symbol<'static, AomiSdkVersionFn>,
}

// Safety: every method explicitly unsafe-borrows the raw `instance`; we
// don't move it across threads. The cdylib is single-threaded per the
// SDK contract.
unsafe impl Send for LoadedPlugin {}
unsafe impl Sync for LoadedPlugin {}

static PLUGIN: OnceLock<LoadedPlugin> = OnceLock::new();

fn plugin() -> &'static LoadedPlugin {
    PLUGIN.get_or_init(|| {
        let path = plugin_path();
        assert!(
            path.exists(),
            "compiled cdylib not found at {}. \
             Build it first with `cargo build -p kairo-aerodrome --release`.",
            path.display(),
        );

        // SAFETY: standard libloading usage. We leak the Library to give it
        // 'static lifetime so the Symbols remain valid for the process.
        let lib: &'static Library = unsafe {
            let raw = Library::new(&path).expect("failed to dlopen plugin");
            Box::leak(Box::new(raw))
        };

        let create: Symbol<AomiCreateFn> =
            unsafe { lib.get(b"aomi_create").expect("symbol aomi_create missing") };
        let destroy: Symbol<AomiDestroyFn> = unsafe {
            lib.get(b"aomi_destroy")
                .expect("symbol aomi_destroy missing")
        };
        let manifest: Symbol<AomiManifestFn> = unsafe {
            lib.get(b"aomi_manifest")
                .expect("symbol aomi_manifest missing")
        };
        let async_start: Symbol<AomiAsyncToolStartFn> = unsafe {
            lib.get(b"aomi_async_tool_start")
                .expect("symbol aomi_async_tool_start missing")
        };
        let exec_poll: Symbol<AomiExecPollFn> = unsafe {
            lib.get(b"aomi_dyn_exec_poll")
                .expect("symbol aomi_dyn_exec_poll missing")
        };
        let free_string: Symbol<AomiFreeStringFn> = unsafe {
            lib.get(b"aomi_free_string")
                .expect("symbol aomi_free_string missing")
        };
        let sdk_version: Symbol<AomiSdkVersionFn> = unsafe {
            lib.get(b"aomi_sdk_version")
                .expect("symbol aomi_sdk_version missing")
        };

        let instance = unsafe { create() };
        assert!(!instance.is_null(), "aomi_create returned null");

        LoadedPlugin {
            _lib: lib,
            instance,
            create,
            destroy,
            manifest,
            async_start,
            exec_poll,
            free_string,
            sdk_version,
        }
    })
}

impl LoadedPlugin {
    /// Consume a `*mut c_char` that the plugin allocated, decode it as JSON,
    /// and free it via `aomi_free_string`.
    fn take_string(&self, ptr: *mut c_char) -> Option<String> {
        if ptr.is_null() {
            return None;
        }
        let s = unsafe { CStr::from_ptr(ptr) }
            .to_string_lossy()
            .into_owned();
        unsafe { (self.free_string)(ptr) };
        Some(s)
    }

    fn manifest_json(&self) -> Value {
        let ptr = unsafe { (self.manifest)(self.instance) };
        let s = self
            .take_string(ptr)
            .expect("aomi_manifest returned null");
        serde_json::from_str(&s).expect("manifest is not valid JSON")
    }

    fn sdk_version_str(&self) -> String {
        let ptr = unsafe { (self.sdk_version)() };
        assert!(!ptr.is_null(), "aomi_sdk_version returned null");
        // sdk_version returns a `*const c_char` to static memory — do not free.
        unsafe { CStr::from_ptr(ptr) }
            .to_string_lossy()
            .into_owned()
    }

    /// Invoke a tool through the C ABI. Returns the parsed `DynToolStart`
    /// JSON envelope. If the tool starts async, polls to completion.
    fn call_tool(&self, name: &str, args: Value) -> Value {
        let name_c = CString::new(name).unwrap();
        let args_c = CString::new(args.to_string()).unwrap();
        let ctx = serde_json::json!({
            "session_id": "test-session",
            "tool_name": name,
            "call_id": "test-call",
            "state_attributes": {},
            "secrets": {},
        });
        let ctx_c = CString::new(ctx.to_string()).unwrap();

        let ptr = unsafe {
            (self.async_start)(
                self.instance,
                name_c.as_ptr(),
                args_c.as_ptr(),
                ctx_c.as_ptr(),
            )
        };
        let s = self
            .take_string(ptr)
            .expect("aomi_async_tool_start returned null");
        let envelope: Value =
            serde_json::from_str(&s).expect("tool envelope is not valid JSON");

        // Handle both Ready and AsyncQueued envelopes by polling. v1 of all
        // our tools is sync, so the first response should be Ready — but
        // we handle async correctly for future-proofing.
        match envelope.get("status").and_then(Value::as_str) {
            Some("ready") => envelope,
            Some("async_queued") => {
                let exec_id = envelope
                    .get("execution_id")
                    .and_then(Value::as_u64)
                    .expect("async_queued must include execution_id");
                self.poll_to_completion(exec_id)
            }
            other => panic!("unexpected DynToolStart status: {other:?} in {envelope:?}"),
        }
    }

    fn poll_to_completion(&self, exec_id: u64) -> Value {
        for _ in 0..200 {
            let ptr = unsafe { (self.exec_poll)(self.instance, exec_id) };
            let s = self
                .take_string(ptr)
                .expect("aomi_dyn_exec_poll returned null");
            let envelope: Value =
                serde_json::from_str(&s).expect("poll envelope is not valid JSON");
            if envelope.get("status").and_then(Value::as_str) == Some("ready") {
                return envelope;
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        panic!("tool execution {exec_id} did not complete within 10 seconds");
    }
}

impl Drop for LoadedPlugin {
    fn drop(&mut self) {
        // Only called at process exit since PLUGIN is OnceLock.
        unsafe { (self.destroy)(self.instance) };
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[test]
fn dlopen_resolves_all_ffi_symbols() {
    // Just constructing the singleton resolves and asserts every symbol.
    let p = plugin();
    let _ = p.instance; // touch field so the optimizer can't drop the init
    // Touch every symbol so the linker can't dead-code-eliminate them in tests.
    let _ = &*p.create;
    let _ = &*p.destroy;
    let _ = &*p.manifest;
    let _ = &*p.async_start;
    let _ = &*p.exec_poll;
    let _ = &*p.free_string;
    let _ = &*p.sdk_version;
    println!("✓ all 7 Aomi runtime C ABI symbols resolved");
    println!("  plugin path: {}", plugin_path().display());
    println!("  sdk version: {}", p.sdk_version_str());
}

#[test]
fn manifest_declares_five_tools() {
    let p = plugin();
    let manifest = p.manifest_json();
    println!(
        "manifest:\n{}",
        serde_json::to_string_pretty(&manifest).unwrap()
    );

    assert_eq!(
        manifest.get("name").and_then(Value::as_str),
        Some("kairo-aerodrome"),
        "manifest.name should be `kairo-aerodrome`",
    );
    assert_eq!(
        manifest.get("version").and_then(Value::as_str),
        Some("0.1.0"),
        "manifest.version should be `0.1.0`",
    );

    let tools = manifest
        .get("tools")
        .and_then(Value::as_array)
        .expect("manifest.tools must be an array");

    let names: Vec<&str> = tools
        .iter()
        .map(|t| t.get("name").and_then(Value::as_str).unwrap_or("?"))
        .collect();

    let expected = [
        "get_positions",
        "get_gauge_signal",
        "get_policy",
        "propose_action",
        "get_receipt",
    ];
    for want in expected {
        assert!(
            names.contains(&want),
            "manifest missing tool `{want}`; got {names:?}",
        );
    }
    assert_eq!(
        tools.len(),
        expected.len(),
        "expected exactly {} tools, got {}: {names:?}",
        expected.len(),
        tools.len(),
    );

    // Every tool must declare a JSON-schema for its parameters — the
    // runtime feeds this to the LLM to constrain tool-call arguments.
    for tool in tools {
        let name = tool.get("name").and_then(Value::as_str).unwrap_or("?");
        assert!(
            tool.get("description")
                .and_then(Value::as_str)
                .is_some_and(|d| !d.is_empty()),
            "tool `{name}` has empty description",
        );
        // The SDK serializes the JSON-schema under one of several keys
        // depending on version: `parameters_schema` (current), `parameters`
        // (older), `input_schema` (some forks). Accept any of them.
        let has_schema = ["parameters_schema", "parameters", "input_schema"]
            .iter()
            .any(|k| tool.get(*k).is_some());
        assert!(
            has_schema,
            "tool `{name}` missing parameters schema (looked for \
             parameters_schema, parameters, input_schema)",
        );
    }
    println!("✓ manifest declares 5 tools, each with a description + schema");
}

#[test]
fn validation_rejects_malformed_wallet_via_ffi() {
    let p = plugin();
    let envelope = p.call_tool(
        "get_positions",
        serde_json::json!({ "wallet": "not-an-address" }),
    );
    let result = envelope
        .get("result")
        .expect("ready envelope must contain result");
    let err = result
        .get("Err")
        .and_then(Value::as_str)
        .expect("malformed wallet should produce a DynToolResult::Err");
    assert!(
        err.contains("0x-prefixed") || err.contains("wallet"),
        "expected a wallet validation error, got `{err}`",
    );
    println!("✓ FFI dispatch correctly rejects malformed wallets: {err}");
}

#[test]
fn validation_rejects_unknown_kind_via_ffi() {
    let p = plugin();
    let envelope = p.call_tool(
        "propose_action",
        serde_json::json!({
            "kind": "fly_to_mars",
            "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0beB1",
            "summary": "I would like to fly to Mars",
        }),
    );
    let result = envelope
        .get("result")
        .expect("ready envelope must contain result");
    let err = result
        .get("Err")
        .and_then(Value::as_str)
        .expect("unknown kind should produce a DynToolResult::Err");
    assert!(
        err.contains("kind must be one of") || err.contains("fly_to_mars"),
        "expected a kind validation error, got `{err}`",
    );
    println!("✓ FFI dispatch correctly rejects unknown action kinds: {err}");
}

#[test]
fn http_layer_fires_on_well_formed_call() {
    // Point at a definitely-dead local port so we don't depend on a live
    // backend. The tool should dispatch all the way to the HTTP layer and
    // return an Err with a connection failure — the important signal is
    // that the SDK router accepted the call and our HTTP client ran.
    // SAFETY: setting env vars in a test process is fine; we don't run
    // multiple tests against KAIRO_API_URL concurrently in this file.
    unsafe { std::env::set_var("KAIRO_API_URL", "http://127.0.0.1:1") };

    let p = plugin();
    let envelope = p.call_tool(
        "get_positions",
        serde_json::json!({ "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0beB1" }),
    );
    let result = envelope
        .get("result")
        .expect("ready envelope must contain result");
    let err = result
        .get("Err")
        .and_then(Value::as_str)
        .expect("dead-port HTTP call should produce a DynToolResult::Err");
    // We don't constrain the exact message — connect refused / connection
    // refused / etc. The key is that it mentions kairo or our URL fragment,
    // which proves the HTTP client (not the validator) produced the error.
    assert!(
        err.contains("kairo")
            || err.contains("127.0.0.1")
            || err.contains("refused")
            || err.contains("Connection")
            || err.contains("error sending"),
        "expected HTTP layer error from dead port, got `{err}`",
    );
    println!("✓ FFI dispatch reaches the HTTP layer; got expected error: {err}");
}
