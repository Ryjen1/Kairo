import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org";
const SEPOLIA_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";

const connectors = [
  injected({ shimDisconnect: true }),
  coinbaseWallet({ appName: "Kairo" }),
  ...(WC_PROJECT_ID
    ? [
        walletConnect({
          projectId: WC_PROJECT_ID,
          showQrModal: true,
          metadata: {
            name: "Kairo",
            description: "Consent and policy for autonomous crypto on Base.",
            url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
            icons: [],
          },
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  // Base mainnet is the primary network. Base Sepolia is included so the
  // on-chain policy reads (KairoPolicy.sol lives on Sepolia for v1) work.
  chains: [base, baseSepolia],
  connectors,
  transports: {
    [base.id]: http(RPC_URL, {
      batch: { batchSize: 20, wait: 16 },
    }),
    [baseSepolia.id]: http(SEPOLIA_RPC_URL, {
      batch: { batchSize: 20, wait: 16 },
    }),
  },
  ssr: true,
});

export type WagmiConfig = typeof wagmiConfig;
