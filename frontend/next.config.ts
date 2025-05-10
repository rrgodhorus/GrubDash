import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: false,
  pageExtensions: ['ts', 'tsx'],
};

export default nextConfig;