import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright hits 127.0.0.1; without this, Next 16 blocks dev assets/HMR.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["geo-tz", "resend"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "*.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
