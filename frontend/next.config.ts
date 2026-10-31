import type { NextConfig } from "next";

// Server-side only: where the FastAPI backend lives. Never exposed to the browser bundle.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Keep streamed NDJSON from being gzipped/buffered by the proxy.
  compress: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "images.qloo.com" }] },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
