import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { resolve } from "node:path";

import { withoutBuildDirVars } from "./build-dirs.mjs";
import {
  generateExampleIndexes,
  watchExampleIndexes,
} from "./demo-ui/index-generator.mjs";
import {
  DEFAULT_MOCK_API_PORT,
  findRunningMockApi,
  startMockApi,
} from "./mock-api/server.mjs";

// 用法：node scripts/run-next.mjs <dev|build|start> [--demo] [其余参数传给 next]
// --demo（package.json 的 demo:* 命令）先启动 Mock API，并让 next 指向它，不管项目配置的后端地址是什么。
// build 和 start 各自启动一次 Mock API，端口固定，所以 build 时内联进产物的地址在 start 时仍然可用。
// 端口上已经有 Mock API（比如开着 demo:dev 时再运行 demo:build）就直接用它，退出时也不关它：它跟着启动它的命令退出。
// 端口由 MOCK_API_PORT 指定；Data demo 的 e2e 用自己的端口（playwright.demo.config.ts），不和 demo:dev 共用。

const COMMANDS = new Set(["dev", "build", "start"]);
const DEFAULT_PORT = 3000;
// 和 next dev 的重试次数一致（next/dist/server/lib/start-server.js）。
const PORT_RETRIES = 10;
const projectRoot = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

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
// demo 和 e2e 的 build 不写 .next（distDir 见 next.config.ts），tsconfig.json 又排除了它们自己的目录，
// 类型检查读的是 .next/types；这份只有 .next 的 build 和 typegen 会写，先刷新它。
if (command === "build" && (demo || process.env.EXPOSE_TESTING_API === "1")) {
  // e2e 的 webServer.env 带着 EXPOSE_TESTING_API，原样继承的话 typegen 会写进 -e2e 目录。
  const typegen = spawnSync(process.execPath, [nextBin, "typegen"], {
    cwd: projectRoot,
    stdio: "inherit",
    env: withoutBuildDirVars(process.env),
  });
  if (typegen.status !== 0) throw new Error("next typegen failed");
}

const mockApi = demo ? await connectMockApi() : null;
// 进程里已有的变量优先于 .env* 文件，所以项目在 .env.local 里配置的后端地址不会覆盖这里。
// NEXT_PUBLIC_MOCK_API 同时让 next.config.ts 把产物放进 demo 的目录。
const childEnv = mockApi
  ? {
      ...process.env,
      NEXT_PUBLIC_API_BASE_URL: mockApi.url,
      NEXT_PUBLIC_MOCK_API: "1",
    }
  : process.env;

const watcher =
  command === "dev" ? await watchExampleIndexes(projectRoot) : null;
if (command === "build") await generateExampleIndexes(projectRoot);

const child = spawn(process.execPath, [nextBin, command, ...nextArgs], {
  cwd: projectRoot,
  stdio: "inherit",
  env: childEnv,
});
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

async function connectMockApi() {
  const port = Number(process.env.MOCK_API_PORT ?? DEFAULT_MOCK_API_PORT);
  const runningUrl = await findRunningMockApi(port);
  if (runningUrl) {
    console.log(`Using the Mock API already running on ${runningUrl}`);
    return { url: runningUrl, close: async () => {} };
  }
  const mockApi = await startMockApi({ port });
  console.log(`Mock API listening on ${mockApi.url}`);
  return mockApi;
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
