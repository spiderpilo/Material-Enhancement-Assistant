import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the production Docker image.
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
