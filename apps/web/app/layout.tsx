import type { Metadata } from "next";
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
  themeColor: "#0B0B0E",
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
