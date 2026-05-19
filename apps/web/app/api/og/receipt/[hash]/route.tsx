import { ImageResponse } from "next/og";
import { getReceipt } from "@/lib/storage";
import { formatBps, formatUsd, shortAddress } from "@/lib/utils";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ hash: string }>;
}

export async function GET(_req: Request, ctx: Params) {
  const { hash } = await ctx.params;
  const receipt = await getReceipt(hash);

  const title = receipt?.proposal.summary ?? "Receipt not found";
  const agent = receipt?.proposal.agentId ?? "—";
  const status = receipt?.status ?? "unknown";
  const statusColor =
    status.startsWith("denied") || status === "expired"
      ? "#f08080"
      : status === "pending_user"
        ? "#f5c26b"
        : "#7fe3c4";

  const amountLabel = receipt
    ? (() => {
        switch (receipt.proposal.kind) {
          case "swap":
            return formatUsd(receipt.proposal.amountInUsd);
          case "add_liquidity":
          case "remove_liquidity":
          case "rebalance":
            return formatUsd(receipt.proposal.amountUsd);
          case "claim_rewards":
            return formatUsd(receipt.proposal.estimatedRewardUsd);
          case "vote_for_gauge":
            return formatBps(receipt.proposal.weightBps);
        }
      })()
    : "";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#0B0B0E",
          color: "#EDEDF0",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "64px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: "#7fe3c4",
              display: "flex",
            }}
          />
          <div style={{ fontSize: 28, fontWeight: 600 }}>kairo</div>
        </div>

        <div
          style={{
            marginTop: 64,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignSelf: "flex-start",
              padding: "6px 14px",
              borderRadius: 6,
              background: `${statusColor}22`,
              color: statusColor,
              fontSize: 22,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            {status.replace(/_/g, " ")}
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          {amountLabel && (
            <div style={{ fontSize: 36, color: "#8a8a95" }}>
              {amountLabel}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            color: "#8a8a95",
            fontSize: 22,
          }}
        >
          <div>agent · {agent}</div>
          <div style={{ fontFamily: "ui-monospace, monospace" }}>
            {shortAddress(hash, 8, 6)}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
