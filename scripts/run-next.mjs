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

// Usage: node scripts/run-next.mjs <dev|build|start> [--demo] [other args, passed to next]
// --demo (package.json's demo:* commands) starts the Mock API first and points next at it, whatever
// backend address the project configures. build and start each start the Mock API once, on a fixed
// port, so the address the build inlines still works at start. When a Mock API is already on the
// port (such as running demo:build while demo:dev is up), it is used and not closed on exit: it
// exits with the command that started it. MOCK_API_PORT sets the port; the Data demo's e2e uses
// its own port (playwright.demo.config.ts) rather than sharing demo:dev's.

const COMMANDS = new Set(["dev", "build", "start"]);
const DEFAULT_PORT = 3000;
// As many retries as next dev makes (next/dist/server/lib/start-server.js).
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
// Without a port, next dev looks for the next free one, while next start exits when its port is
// taken; this gives start the same behavior as dev.
if (command === "start" && !hasExplicitPort(nextArgs)) {
  nextArgs.push("--port", String(await findFreePort(DEFAULT_PORT)));
}
// The demo and e2e builds do not write .next (distDir in next.config.ts), and tsconfig.json excludes
// their own directories, so type checking reads .next/types, which only the .next build and typegen
// write: refresh it first.
if (command === "build" && (demo || process.env.EXPOSE_TESTING_API === "1")) {
  // The e2e webServer.env carries EXPOSE_TESTING_API; inherited as is, it would make typegen write
  // to the -e2e directory.
  const typegen = spawnSync(process.execPath, [nextBin, "typegen"], {
    cwd: projectRoot,
    stdio: "inherit",
    env: withoutBuildDirVars(process.env),
  });
  if (typegen.status !== 0) throw new Error("next typegen failed");
}

const mockApi = demo ? await connectMockApi() : null;
// Variables already in the process take precedence over .env* files, so a backend address the
// project sets in .env.local does not override this one. NEXT_PUBLIC_MOCK_API also makes
// next.config.ts put the build in the demo directory.
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

/** Whether the arguments or PORT already set the port: then it is used as given, and next fails when it is taken. */
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

/** The first port from `from` that can be listened on; like next, it gives no host, so it listens on every address. */
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
