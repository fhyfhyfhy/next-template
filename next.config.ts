import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // demo:* 命令（scripts/run-next.mjs --demo）把 Mock API 的地址内联进产物，单独放一个目录，
  // 免得和项目自己的 build 互相覆盖，让 pnpm start 跑起一个指向 Mock API 的版本。
  distDir: process.env.NEXT_PUBLIC_MOCK_API === "1" ? ".next-demo" : ".next",
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
