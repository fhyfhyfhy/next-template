import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import {
  generateExampleIndexes,
  watchExampleIndexes,
} from "./demo-ui/index-generator.mjs";
import { DEFAULT_MOCK_API_PORT, startMockApi } from "./mock-api/server.mjs";

// 用法：node scripts/run-next.mjs <dev|build|start> [--demo] [其余参数传给 next]
// --demo（package.json 的 demo:* 命令）先启动 Mock API，并让 next 指向它，不管项目配置的后端地址是什么。
// build 和 start 各自启动一次 Mock API，端口固定，所以 build 时内联进产物的地址在 start 时仍然可用。

const COMMANDS = new Set(["dev", "build", "start"]);
const projectRoot = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

const [command, ...rest] = process.argv.slice(2);
if (!COMMANDS.has(command)) {
  throw new Error(
    "Usage: node scripts/run-next.mjs <dev|build|start> [--demo] [next args]",
  );
}
const demo = rest.includes("--demo");
const nextArgs = rest.filter((arg) => arg !== "--demo");

const mockApi = demo
  ? await startMockApi({
      port: Number(process.env.MOCK_API_PORT ?? DEFAULT_MOCK_API_PORT),
    })
  : null;
// 进程里已有的变量优先于 .env* 文件，所以项目在 .env.local 里配置的后端地址不会覆盖这里。
// NEXT_PUBLIC_MOCK_API 同时让 next.config.ts 把产物放进 .next-demo。
const childEnv = mockApi
  ? {
      ...process.env,
      NEXT_PUBLIC_API_BASE_URL: mockApi.url,
      NEXT_PUBLIC_MOCK_API: "1",
    }
  : process.env;
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
