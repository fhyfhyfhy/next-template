import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// 用法：pnpm e2e:at <commit> [playwright test 的参数]
// 用这份 checkout 的 e2e/ 和 Playwright 配置，测 <commit> 的应用代码：确认为某个 bug 写的 spec 在修复前的提交上
// 会失败（.claude/rules/e2e.md 的 Regression specs）。端口照常由 E2E_PORT、DEMO_E2E_PORT 等变量决定。

const projectRoot = resolve(import.meta.dirname, "..");
const [ref, ...rest] = process.argv.slice(2);
const playwrightArgs = rest[0] === "--" ? rest.slice(1) : rest;
const pnpm = process.env.npm_execpath;
if (!ref || !pnpm) {
  throw new Error(
    "Usage: pnpm e2e:at <commit> [playwright test args]; run it through pnpm so it can install dependencies",
  );
}

const sha = git(["rev-parse", "--short", `${ref}^{commit}`]).trim();
const dir = join(tmpdir(), `next-template-e2e-at-${sha}`);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
await extract(sha, dir);

// 换上当前的 spec 和配置：要测的是现在写的 spec，旧提交里可能还没有它们。
rmSync(join(dir, "e2e"), { recursive: true, force: true });
cpSync(join(projectRoot, "e2e"), join(dir, "e2e"), { recursive: true });
for (const file of ["playwright.config.ts", "playwright.demo.config.ts"]) {
  cpSync(join(projectRoot, file), join(dir, file));
}

runPnpm(["install", "--frozen-lockfile", "--prefer-offline"]);
console.log(`Running this checkout's e2e against ${sha} in ${dir}`);
process.exitCode = runPnpm(["exec", "playwright", "test", ...playwrightArgs], {
  check: false,
});

function git(args) {
  const result = spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
  });
  if (result.status !== 0)
    throw new Error(result.stderr || `git ${args[0]} failed`);
  return result.stdout;
}

/** `git archive` 的 tar 流直接交给 tar 解开；Windows 10 起自带 tar。 */
function extract(commit, target) {
  return new Promise((resolveExtract, reject) => {
    const archive = spawn("git", ["archive", "--format=tar", commit], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "inherit"],
    });
    const tar = spawn("tar", ["-x", "-C", target], {
      stdio: ["pipe", "inherit", "inherit"],
    });
    archive.stdout.pipe(tar.stdin);
    archive.once("error", reject);
    tar.once("error", reject);
    tar.once("exit", (code) =>
      code === 0 ? resolveExtract() : reject(new Error("tar failed")),
    );
  });
}

/** pnpm 有 JS 入口，也有原生可执行文件（pnpm 12 起），`npm_execpath` 指向哪一种就怎么运行。 */
function runPnpm(args, { check = true } = {}) {
  const viaNode = /\.[cm]?js$/.test(pnpm);
  const result = spawnSync(
    viaNode ? process.execPath : pnpm,
    viaNode ? [pnpm, ...args] : args,
    { cwd: dir, stdio: "inherit" },
  );
  if (check && result.status !== 0) {
    throw new Error(`pnpm ${args[0]} failed`);
  }
  return result.status ?? 1;
}
