import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone is required for custom Windows VPS/Docker deployments, but conflicts with Vercel/Netlify serverless bundlers
  ...(process.env.VERCEL || process.env.NETLIFY ? {} : { output: "standalone" }),
  experimental: {
    serverActions: {
      allowedOrigins: [
        "printdpigh.com",
        "www.printdpigh.com",
        "printflow-dpi.netlify.app",
        "printflow-dusky-nine.vercel.app",
      ],
    },
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
