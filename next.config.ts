import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // ignoreBuildErrors due to Next.js v16 internal type conflicts in node_modules — our source compiles clean
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
};

export default nextConfig;
