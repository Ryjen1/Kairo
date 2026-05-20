"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  Coins,
  Bot,
  Scale,
  Receipt,
  Trophy,
} from "lucide-react";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/app", label: "Positions", icon: Coins },
  { href: "/app/agents", label: "Agents", icon: Bot },
  { href: "/app/policy", label: "Policy", icon: Scale },
  { href: "/app/receipts", label: "Receipts", icon: Receipt },
  { href: "/arena", label: "Arena", icon: Trophy, external: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none" />

      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <Logo />
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {nav.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href ||
                  (href !== "/app" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all",
                      active
                        ? "border border-primary/20 bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <ConnectButton
            showBalance={false}
            accountStatus="address"
            chainStatus="icon"
          />
        </div>

        {/* Mobile-only nav strip */}
        <nav className="md:hidden border-t border-border/50 bg-background/60 backdrop-blur-xl">
          <div className="container flex h-12 items-center gap-1 overflow-x-auto">
            {nav.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href !== "/app" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="container relative animate-fade-in py-8">{children}</main>
    </div>
  );
}
