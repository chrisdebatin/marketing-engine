import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't pick up the lockfile in $HOME.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
