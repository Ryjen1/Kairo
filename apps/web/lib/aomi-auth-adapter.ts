/**
 * Compatibility shim for the AomiFrame widget. The widget components
 * (aomi-frame.tsx, runtime-tx-handler.tsx, control-bar/*) import their
 * auth adapter from `@/lib/aomi-auth-adapter`. The real adapter lives in
 * `components/aomi-auth-adapter/` so the install can keep all React-y
 * code under `components/`.
 *
 * This file re-exports everything the widget needs.
 */
export * from "@/components/aomi-auth-adapter";
