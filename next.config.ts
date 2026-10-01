import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["pdfmake"],
  experimental: {
    serverActions: {
      bodySizeLimit: "1000mb",
      // Browser-preview proxy origins (port changes per session) + local dev.
      allowedOrigins: ["127.0.0.1", "127.0.0.1:60710", "localhost:3000"],
    },
  },
};

export default nextConfig;
