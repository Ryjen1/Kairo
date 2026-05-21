"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield,
  Repeat,
  Coins,
  GaugeCircle,
  Scale,
  Receipt,
  ArrowRight,
} from "lucide-react";
import { Logo } from "@/components/logo";

const features = [
  {
    icon: Scale,
    title: "Policy Engine",
    desc: "Caps, allowlists, APR thresholds — enforced before any tx",
  },
  {
    icon: GaugeCircle,
    title: "Live Gauge Signals",
    desc: "Real vote-weighted APR from Aerodrome's Voter contract",
  },
  {
    icon: Shield,
    title: "On-chain Leash",
    desc: "KairoPolicy.sol mirrors your policy to Base — verifiable",
  },
  {
    icon: Receipt,
    title: "Public Receipts",
    desc: "Every decision a shareable URL with OG-card preview",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-40 pointer-events-none" />

      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/aomi"
              className="hidden sm:inline-flex rounded-lg px-3.5 py-2 font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              Aomi plugin
            </Link>
            <Link
              href="/arena"
              className="hidden sm:inline-flex rounded-lg px-3.5 py-2 font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              Arena
            </Link>
            <a
              href="https://github.com/Ryjen1/Kairo"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex rounded-lg px-3.5 py-2 font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-emerald-glow hover:shadow-glow-sm transition-all"
            >
              Open app
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative container">
        <section className="relative mx-auto max-w-3xl pt-24 pb-12">
          <div className="hero-glow" />

          <div className="relative text-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 mb-6">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-medium text-primary">
                  Aerodrome Safe LP Agent · Base
                </span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-balance text-4xl font-extrabold tracking-tight leading-[1.05] sm:text-5xl md:text-6xl text-foreground mb-5"
            >
              Your agent acts.
              <br />
              <span className="text-primary">Kairo decides.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto max-w-xl text-balance text-base text-muted-foreground sm:text-lg"
            >
              An autonomous LP agent for Aerodrome — bounded by a policy you
              set, simulated before it touches your wallet, verifiable on-chain.
              Every decision a public receipt.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              <Link
                href="/app"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-emerald-glow hover:shadow-glow-sm transition-all"
              >
                Open dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/arena"
                className="inline-flex items-center rounded-lg border border-border bg-secondary px-5 py-3 text-foreground hover:bg-surface-3 transition-colors"
              >
                See the Arena
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-8 text-xs text-muted-foreground"
            >
              Non-custodial. Simulation-first. Verifiable on Base.
            </motion.p>
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mx-auto max-w-3xl py-8"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="glass-card p-4 text-center transition-colors hover:border-primary/20 group"
              >
                <Icon className="mx-auto mb-2 h-5 w-5 text-primary transition-transform group-hover:scale-110" />
                <p className="mb-1 text-xs font-semibold text-foreground">
                  {title}
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </motion.section>

        <section id="how" className="mx-auto max-w-4xl py-16">
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="glass-card p-6 transition-colors hover:border-primary/20"
              >
                <div className="mb-3 font-mono text-xs uppercase tracking-wider text-primary">
                  {s.step}
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  {s.title}
                </h3>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl py-16">
          <figure className="border-l-2 border-primary pl-6">
            <blockquote className="text-balance text-2xl font-semibold leading-snug md:text-3xl">
              The investor&apos;s chief problem — and even his worst enemy — is
              likely to be himself.
            </blockquote>
            <figcaption className="mt-3 text-sm text-muted-foreground">
              <span className="text-foreground">Benjamin Graham</span> · The
              Intelligent Investor
            </figcaption>
          </figure>
        </section>

        <section className="mx-auto max-w-3xl py-16">
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                steward · live
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                tick
              </span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-muted-foreground">
{`$ kairo start --agent steward --wallet 0x742d…0beB1
› reading positions on base mainnet
› 2 aerodrome positions discovered
› reading gauge weights from voter.sol
∙ vAMM-WETH/USDC  share 4.21%  est apr 12.3%
∙ sAMM-USDC/USDbC share 8.04%  est apr 17.5%
∙ candidate rebalance: +5.20% apr uplift
› simulating swap on aerodrome v2 · slippage 0.07%
› route ok  est fill 200 USDC → 200.04 sAMM
∙ policy check — max spend $250 · cap $1,000 · pool allowlist ✓
`}
              <span className="text-primary">{`✓ AUTO-APPROVED · receipt 0x1adf…3b87
`}</span>
{`∙ tx 0x9c…f4 confirmed block 46,120,402
› idle until next signal`}
            </pre>
          </div>
        </section>

        <section className="mx-auto max-w-3xl py-16">
          <div className="glass-card overflow-hidden">
            <div className="border-b border-border/50 px-5 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              receipt · kairo.dev/r/0xa8…2c1f
            </div>
            <div className="p-6">
              <div className="mb-1 text-sm text-muted-foreground">
                Aerodrome Steward proposed
              </div>
              <div className="text-balance text-lg text-foreground">
                Move $380 from vAMM-USDC/ETH to sAMM-USDC/USDT
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <Row label="Projected APR delta" value="+5.20%" tone="primary" />
                <Row label="Projected IL" value="0.18%" />
                <Row label="Per-action cap" value="$500" />
                <Row label="Daily cap remaining" value="$842 of $1,000" />
                <Row label="Decision" value="Auto-approved" tone="primary" />
                <Row label="Tx" value="0x9d…40a1" mono />
              </dl>
            </div>
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Every action becomes a receipt. Shareable, verifiable, hers to keep.
          </p>
        </section>
      </main>

      <footer className="container relative border-t border-border/50 py-10 text-sm text-muted-foreground">
        <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <Logo />
          <div>Aerodrome Safe LP Agent · Built on Base</div>
        </div>
      </footer>
    </div>
  );
}

const steps = [
  {
    step: "01 · set",
    title: "Define the leash",
    body: "Spend cap per action, daily cap, allowed pools, minimum APR delta. Three modes — Ask, Allow under limits, Block. Or just type it in plain English.",
  },
  {
    step: "02 · propose",
    title: "Agent proposes",
    body: "Every action is typed, simulated against live chain state, and explained in plain English before it touches your wallet.",
  },
  {
    step: "03 · decide",
    title: "Kairo decides",
    body: "Inside policy? Auto-approve. Anything bigger? Telegram ping. Every decision a public receipt with an OG-card preview.",
  },
];

function Row({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: string;
  tone?: "primary";
  mono?: boolean;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`text-right ${mono ? "font-mono" : ""} ${
          tone === "primary" ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </dd>
    </>
  );
}
