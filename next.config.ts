import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverActions: {
    bodySizeLimit: "100mb",
  },
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
