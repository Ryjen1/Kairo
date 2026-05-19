import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getReceipt } from "@/lib/storage";
import { Logo } from "@/components/logo";
import { formatBps, formatUsd, relativeTime, shortAddress } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";

interface PageProps {
  params: Promise<{ hash: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { hash } = await params;
  const receipt = await getReceipt(hash);
  if (!receipt) return { title: "Receipt not found · Kairo" };
  const title = `Kairo receipt · ${receipt.proposal.summary}`;
  const desc =
    receipt.decision.kind === "auto_approve"
      ? "Auto-approved by policy."
      : receipt.decision.kind === "denied"
        ? "Blocked by policy."
        : "Awaiting user decision.";
  const ogImage = `/api/og/receipt/${hash}`;
  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [ogImage],
    },
  };
}

export default async function ReceiptPage({ params }: PageProps) {
  const { hash } = await params;
  const receipt = await getReceipt(hash);
  if (!receipt) notFound();

  return (
    <div className="min-h-screen">
      <header className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
        </Link>
        <Link
          href="/app/receipts"
          className="text-sm text-text-dim hover:text-text"
        >
          All receipts →
        </Link>
      </header>

      <main className="container">
        <div className="mx-auto max-w-2xl py-10">
          <div className="card-2 overflow-hidden">
            <div className="border-b border-line px-6 py-3 font-mono text-xs uppercase tracking-wider text-text-dim">
              receipt · {shortAddress(receipt.hash, 8, 6)}
            </div>
            <div className="space-y-6 p-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={receipt.status} />
                  <span className="text-xs text-text-dim">
                    {relativeTime(receipt.finalizedAt)}
                  </span>
                </div>
                <div className="mt-3 text-xs uppercase tracking-wider text-text-dim">
                  {receipt.proposal.agentId} proposed
                </div>
                <h1 className="mt-1 text-balance text-2xl font-medium leading-tight">
                  {receipt.proposal.summary}
                </h1>
              </div>

              <Section title="Proposal">
                <Detail label="Wallet" value={shortAddress(receipt.proposal.wallet)} mono />
                <Detail label="Agent" value={receipt.proposal.agentId} mono />
                <Detail label="Kind" value={receipt.proposal.kind} mono />
                {receipt.proposal.kind === "rebalance" && (
                  <>
                    <Detail
                      label="From pool"
                      value={shortAddress(receipt.proposal.fromPool)}
                      mono
                    />
                    <Detail
                      label="To pool"
                      value={shortAddress(receipt.proposal.toPool)}
                      mono
                    />
                    <Detail
                      label="Amount"
                      value={formatUsd(receipt.proposal.amountUsd)}
                    />
                    <Detail
                      label="Projected APR delta"
                      value={formatBps(receipt.proposal.projectedAprDeltaBps)}
                      accent
                    />
                    {receipt.proposal.projectedImpermanentLossBps !==
                      undefined && (
                      <Detail
                        label="Projected IL"
                        value={formatBps(
                          receipt.proposal.projectedImpermanentLossBps,
                        )}
                      />
                    )}
                  </>
                )}
                {receipt.proposal.kind === "swap" && (
                  <>
                    <Detail
                      label="Token in"
                      value={shortAddress(receipt.proposal.tokenIn)}
                      mono
                    />
                    <Detail
                      label="Token out"
                      value={shortAddress(receipt.proposal.tokenOut)}
                      mono
                    />
                    <Detail
                      label="Amount in"
                      value={formatUsd(receipt.proposal.amountInUsd)}
                    />
                    <Detail
                      label="Expected out"
                      value={formatUsd(receipt.proposal.expectedAmountOutUsd)}
                    />
                    <Detail
                      label="Slippage tolerance"
                      value={formatBps(receipt.proposal.slippageBps)}
                    />
                  </>
                )}
                {receipt.proposal.kind === "claim_rewards" && (
                  <>
                    <Detail
                      label="Pool"
                      value={shortAddress(receipt.proposal.pool)}
                      mono
                    />
                    <Detail
                      label="Estimated reward"
                      value={formatUsd(receipt.proposal.estimatedRewardUsd)}
                      accent
                    />
                  </>
                )}
              </Section>

              <Section title="Decision">
                <Detail
                  label="Outcome"
                  value={prettyDecision(receipt.decision.kind)}
                  accent={receipt.decision.kind === "auto_approve"}
                  deny={receipt.decision.kind === "denied"}
                />
                <Detail label="Reason" value={receipt.decision.reason} wide />
                <Detail
                  label="Decided by"
                  value={receipt.decisionActor}
                  mono
                />
              </Section>

              {receipt.decision.rulesApplied.length > 0 && (
                <Section title="Rules">
                  <ul className="col-span-2 space-y-2">
                    {receipt.decision.rulesApplied.map((r, i) => (
                      <li
                        key={i}
                        className="flex items-start justify-between gap-3 rounded-md border border-line px-3 py-2"
                      >
                        <div className="mono text-xs text-text-dim">
                          {r.rule}
                        </div>
                        <div className="text-right text-sm">
                          <span
                            className={
                              r.passed ? "text-accent" : "text-deny"
                            }
                          >
                            {r.passed ? "passed" : "failed"}
                          </span>
                          <div className="text-xs text-text-dim">
                            {r.detail}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {receipt.txHash && (
                <Section title="Execution">
                  <Detail label="Tx hash" value={receipt.txHash} mono wide />
                </Section>
              )}
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-text-dim">
            This page is the canonical record. Share the URL — anyone can verify.
          </p>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xs uppercase tracking-wider text-text-dim">
        {title}
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">{children}</dl>
    </section>
  );
}

function Detail({
  label,
  value,
  mono,
  accent,
  deny,
  wide,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
  deny?: boolean;
  wide?: boolean;
}) {
  return (
    <>
      <dt className={wide ? "col-span-2 text-text-dim" : "text-text-dim"}>
        {label}
      </dt>
      <dd
        className={`${wide ? "col-span-2" : "text-right"} ${
          mono ? "mono break-all" : ""
        } ${accent ? "text-accent" : deny ? "text-deny" : ""}`}
      >
        {value}
      </dd>
    </>
  );
}

function prettyDecision(kind: string): string {
  if (kind === "auto_approve") return "Auto-approved";
  if (kind === "denied") return "Denied";
  return "Needs your approval";
}
