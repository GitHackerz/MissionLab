import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Isolate build output when validating beside an already-running checkout.
  distDir: process.env.MISSIONLAB_DIST_DIR || '.next',
  devIndicators: false,
  reactStrictMode: true,
  transpilePackages: ['three'],
};

export default nextConfig;
