import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // demo:* 命令（scripts/run-next.mjs --demo）把 Mock API 的地址内联进产物，单独放一个目录，
  // 免得和项目自己的 build 互相覆盖，让 pnpm start 跑起一个指向 Mock API 的版本。
  distDir: process.env.NEXT_PUBLIC_MOCK_API === "1" ? ".next-demo" : ".next",
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingIncludes: {
    "/demos/ui": [
      "./features/demo-ui/components/*-examples/*.example.tsx",
      "./features/demo-ui/components/*-examples/playground.tsx",
    ],
  },
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
