import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone is required for custom Windows VPS/Docker deployments, but conflicts with Vercel's serverless bundler
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  experimental: {
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
