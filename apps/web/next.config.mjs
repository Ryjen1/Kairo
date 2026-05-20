/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@kairo/policy", "@kairo/sdk"],
  experimental: {
    typedRoutes: false,
  },
  webpack(config, { isServer }) {
    // Silence noisy optional-dep warnings from @metamask/sdk + pino. None of
    // these packages are actually used at runtime — they're peer/optional
    // deps that bundle paths reference but never invoke.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /@metamask\/sdk/,
        message:
          /Can't resolve '@react-native-async-storage\/async-storage'/,
      },
      { module: /pino/, message: /Can't resolve 'pino-pretty'/ },
    ];

    // Tell webpack to treat these as external no-ops in the server bundle
    // so they don't crash route compilation when they're transitively
    // pulled in by wagmi's metaMask connector.
    if (isServer) {
      config.externals = [
        ...(config.externals ?? []),
        "@react-native-async-storage/async-storage",
        "pino-pretty",
      ];
    }

    return config;
  },
};

export default nextConfig;
