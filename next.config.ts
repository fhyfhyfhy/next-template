import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/showcase": [
      "./features/component-showcase/components/*-examples/*.example.tsx",
      "./features/component-showcase/components/*-examples/playground.tsx",
    ],
  },
};

export default nextConfig;
