import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { watchExampleIndexes } from "./index-generator.mjs";

const projectRoot = resolve(import.meta.dirname, "../..");
const watcher = await watchExampleIndexes(projectRoot);
const require = createRequire(import.meta.url);
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "dev", ...process.argv.slice(2)],
  { cwd: projectRoot, stdio: "inherit" },
);
const signalHandlers = new Map(
  ["SIGINT", "SIGTERM"].map((signal) => [
    signal,
    () => {
      void watcher.close();
      child.kill(signal);
    },
  ]),
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
  await watcher.close();
  for (const [signal, handler] of signalHandlers) process.off(signal, handler);
}
