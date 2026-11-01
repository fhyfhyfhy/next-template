import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { buildDir } from "./scripts/build-dirs.mjs";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

// One directory per kind of build; scripts/build-dirs.mjs lists them and the
// files that must exclude them too.
const distDir = buildDir(process.env);

const nextConfig: NextConfig = {
  distDir,
  cacheComponents: true,
  // The built-in in-memory handler drops an entry in production once its
  // cacheLife revalidate passes, so the request waits for fresh data; this
  // one keeps it until expire, so production serves the stale entry and
  // refreshes in the background, as dev does. An absolute path: Next checks
  // the config against the working directory but resolves a relative path
  // against distDir at run time.
  cacheHandlers: { default: require.resolve("./lib/cache-handler.mts") },
  partialPrefetching: true,
  outputFileTracingIncludes: {
    "/[locale]/demos/ui": [
      "./features/demo-ui/components/*-examples/*.example.tsx",
      "./features/demo-ui/components/*-examples/playground.tsx",
    ],
  },
  experimental: {
    agentUpgrade: "security",
    // For @next/playwright's instant(); only the e2e builds turn it on
    // (webServer.env in playwright*.config.ts). Never in a deployed build.
    exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === "1",
    // @mantine/hooks is not among the packages Next optimizes by default;
    // without it dev loads every module of its barrel.
    optimizePackageImports: ["@mantine/hooks"],
    // The root layout sits under [locale], so a request that matches no
    // route renders app/global-not-found.tsx.
    globalNotFound: true,
  },
};

export default withNextIntl(nextConfig);
