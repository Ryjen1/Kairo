import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Kairo — Aerodrome Safe LP Agent",
  description:
    "Autonomous LP management for Aerodrome on Base. Set a policy, let the agent act within it, get pinged for anything bigger. Every decision a public, verifiable receipt.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kairo",
  },
  openGraph: {
    title: "Kairo — Aerodrome Safe LP Agent",
    description:
      "Your agent acts. Kairo decides. Consent and policy for autonomous LP on Base.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kairo — Aerodrome Safe LP Agent",
    description:
      "Your agent acts. Kairo decides. Consent and policy for autonomous LP on Base.",
  },
};

// Next 15 moved themeColor / colorScheme out of `metadata` and into `viewport`.
export const viewport: Viewport = {
  themeColor: "#0B0B0E",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
