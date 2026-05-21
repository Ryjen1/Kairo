"use client";

import { AomiFrame } from "@/components/aomi-frame";
import { ConnectGate } from "@/components/ConnectGate";

/**
 * The Aomi-powered chat surface inside Kairo.
 *
 * The AomiFrame widget streams every message to `NEXT_PUBLIC_BACKEND_URL`
 * (the Aomi-hosted runtime at https://api.aomi.dev by default). The LLM
 * picks tools from whichever Aomi App the user selects in the ControlBar
 * — when our `kairo-aerodrome` plugin is published upstream it will appear
 * in that list and the agent will be able to call `get_positions`,
 * `propose_action`, and the rest of our typed tools.
 *
 * Today this page demonstrates the live Aomi runtime end-to-end. The user
 * selects an app, pastes their Aomi API key in the ControlBar, and starts
 * chatting. The conversation, tool calls, and streaming responses are all
 * served by Aomi.
 */
export default function ChatPage() {
  return (
    <ConnectGate>
      {() => (
        <div className="space-y-4">
          <div>
            <p className="mb-1 font-mono text-xs uppercase tracking-[0.18em] text-primary">
              aomi runtime · live
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Chat with Aomi
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              This panel streams to{" "}
              <span className="font-mono text-foreground">api.aomi.dev</span>.
              Select an Aomi App in the toolbar, paste your API key, and ask
              about your positions, gauge weights, or whatever the selected app
              exposes. Once the{" "}
              <span className="font-mono text-foreground">kairo-aerodrome</span>{" "}
              plugin ships upstream, the agent will be able to call our five
              typed tools directly from this chat.
            </p>
          </div>

          <div
            className="overflow-hidden rounded-2xl border border-border bg-card"
            style={{ height: "calc(100vh - 17rem)" }}
          >
            <AomiFrame
              backendUrl={
                process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://api.aomi.dev"
              }
              height="100%"
              width="100%"
              walletPosition="footer"
            />
          </div>
        </div>
      )}
    </ConnectGate>
  );
}
