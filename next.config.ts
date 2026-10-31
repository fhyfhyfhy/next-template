import type { NextConfig } from "next";

import { buildDir } from "./scripts/build-dirs.mjs";

// 每种产物各放一个目录，规则和要同步排除它们的文件见 scripts/build-dirs.mjs。
const distDir = buildDir(process.env);

const nextConfig: NextConfig = {
  distDir,
  cacheComponents: true,
  // 内置的内存 handler 在生产环境过了 cacheLife 的 revalidate 就丢弃条目，请求只能同步等新数据；
  // 这个 handler 保留到 expire，生产环境和 dev 一样先返回旧数据、后台刷新。
  // 必须是绝对路径：Next 校验配置时按当前目录解析，运行时又按 distDir 解析相对路径。
  cacheHandlers: { default: require.resolve("./lib/cache-handler.mts") },
  partialPrefetching: true,
  outputFileTracingIncludes: {
    "/demos/ui": [
      "./features/demo-ui/components/*-examples/*.example.tsx",
      "./features/demo-ui/components/*-examples/playground.tsx",
    ],
  },
  experimental: {
    agentUpgrade: "security",
    // @next/playwright 的 instant() 要用；只由 e2e 的 build 打开（playwright*.config.ts 的 webServer.env），
    // 不要带进面向用户的部署。
    exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === "1",
    // @mantine/hooks 不在 Next 默认优化的包里；不加的话 dev 会加载它 barrel 里的全部模块。
    optimizePackageImports: ["@mantine/hooks"],
  },
};

export default nextConfig;
