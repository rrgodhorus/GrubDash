import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: false,
  pageExtensions: ['ts', 'tsx'],
};

export default nextConfig;