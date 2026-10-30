import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
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
const DEFAULT_PORT = 3000;
// 和 next dev 的重试次数一致（next/dist/server/lib/start-server.js）。
const PORT_RETRIES = 10;
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
// next dev 在没指定端口时会自己往后找空闲端口，next start 端口被占直接退出，这里给 start 补上同样的行为。
if (command === "start" && !hasExplicitPort(nextArgs)) {
  nextArgs.push("--port", String(await findFreePort(DEFAULT_PORT)));
}

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

/** 命令行参数或 PORT 已经指定了端口时，按指定的来，被占就让 next 报错。 */
function hasExplicitPort(args) {
  return (
    process.env.PORT !== undefined ||
    args.some(
      (arg) =>
        arg === "-p" ||
        arg === "--port" ||
        arg.startsWith("--port=") ||
        /^-p\d+$/.test(arg),
    )
  );
}

/** 从 `from` 开始找第一个能监听的端口；和 next 一样不指定 host，监听所有地址。 */
async function findFreePort(from) {
  for (let port = from; port <= from + PORT_RETRIES; port++) {
    if (await canListen(port)) {
      if (port !== from) {
        console.log(`Port ${from} is in use, using available port ${port}.`);
      }
      return port;
    }
  }
  throw new Error(
    `Ports ${from}-${from + PORT_RETRIES} are all in use; pass --port to choose one.`,
  );
}

function canListen(port) {
  return new Promise((resolveFree, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") resolveFree(false);
      else reject(error);
    });
    server.listen(port, () => server.close(() => resolveFree(true)));
  });
}
