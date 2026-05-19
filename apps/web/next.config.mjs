/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@kairo/policy", "@kairo/sdk"],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
