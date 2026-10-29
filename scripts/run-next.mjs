import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import {
  generateExampleIndexes,
  watchExampleIndexes,
} from "./demo-ui/index-generator.mjs";
import { DEFAULT_MOCK_API_PORT, startMockApi } from "./mock-api/server.mjs";

// 用法：node scripts/run-next.mjs <dev|build|start> [--demos] [其余参数传给 next]
// 项目没配置 NEXT_PUBLIC_API_BASE_URL 时，先启动 Mock API 并让 next 指向它；--demos 不管配置都这样做。
// build 和 start 各自启动一次 Mock API，端口固定，所以 build 时内联进产物的地址在 start 时仍然可用。

const COMMANDS = new Set(["dev", "build", "start"]);
const projectRoot = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

const [command, ...rest] = process.argv.slice(2);
if (!COMMANDS.has(command)) {
  throw new Error(
    "Usage: node scripts/run-next.mjs <dev|build|start> [--demos] [next args]",
  );
}
const forceMock = rest.includes("--demos");
const nextArgs = rest.filter((arg) => arg !== "--demos");

const env = loadNextEnv(command === "dev");
const mockApi =
  forceMock || !env.NEXT_PUBLIC_API_BASE_URL
    ? await startMockApi({
        port: Number(env.MOCK_API_PORT ?? DEFAULT_MOCK_API_PORT),
      })
    : null;
const childEnv = mockApi
  ? { ...env, NEXT_PUBLIC_API_BASE_URL: mockApi.url, NEXT_PUBLIC_MOCK_API: "1" }
  : env;
if (mockApi) console.log(`Mock API listening on ${mockApi.url}`);

const watcher =
  command === "dev" ? await watchExampleIndexes(projectRoot) : null;
if (command === "build") await generateExampleIndexes(projectRoot);

const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), command, ...nextArgs],
  { cwd: projectRoot, stdio: "inherit", env: childEnv },
);
const signalHandlers = new Map(
  ["SIGINT", "SIGTERM"].map((signal) => [signal, () => child.kill(signal)]),
);
for (const [signal, handler] of signalHandlers) process.on(signal, handler);

try {
  process.exitCode = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolveExit(code ?? (signal === "SIGINT" ? 130 : 143));
    });
  });
} finally {
  await watcher?.close();
  await mockApi?.close();
  for (const [signal, handler] of signalHandlers) process.off(signal, handler);
}

/** 按 next 的规则读 .env* 文件，判断项目是否配置了真实后端。进程里已有的变量优先。 */
function loadNextEnv(dev) {
  const nextRequire = createRequire(require.resolve("next/package.json"));
  const { loadEnvConfig } = nextRequire("@next/env");
  return {
    ...loadEnvConfig(projectRoot, dev, { info() {}, error() {} }).combinedEnv,
  };
}
