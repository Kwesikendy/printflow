import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-ignore
  serverActions: {
    bodySizeLimit: "400mb",
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
