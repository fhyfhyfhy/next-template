import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// 用法：pnpm e2e:at <commit> [playwright test 的参数]
// 用这份 checkout 的 e2e/ 和 Playwright 配置，测 <commit> 的应用代码：确认为某个 bug 写的 spec 在修复前的提交上
// 会失败（.claude/rules/e2e.md 的 Regression specs）。端口照常由 E2E_PORT 决定。
// e2e 引入的 scripts/local-services/、webServer 运行的 reset.mjs 和 run-next.mjs 等 scripts/ 都来自 <commit>，不复制：
// 那个提交要有这份 e2e 用到的文件，没有 scripts/local-services/storage.mjs 的提交跑不起来。项目在 monorepo 里时，
// 项目目录以外的文件也来自 <commit>。

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
// 解开整个提交，在项目所在的位置运行：项目是 monorepo 的一个子目录时，它用到的目录外的文件也在原来的相对位置。
// 项目就在仓库根目录时，两者是同一个目录。
const repoRoot = git(["rev-parse", "--show-toplevel"]).trim();
const prefix = git(["rev-parse", "--show-prefix"]).trim();
const base = join(tmpdir(), `next-template-e2e-at-${sha}`);
const dir = join(base, prefix);
rmSync(base, { recursive: true, force: true });
mkdirSync(base, { recursive: true });
await extract(sha, repoRoot, base);

// 换上当前的 spec 和配置：要测的是现在写的 spec，旧提交里可能还没有它们。
rmSync(join(dir, "e2e"), { recursive: true, force: true });
cpSync(join(projectRoot, "e2e"), join(dir, "e2e"), { recursive: true });
cpSync(
  join(projectRoot, "playwright.config.ts"),
  join(dir, "playwright.config.ts"),
);

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
function extract(commit, from, target) {
  return new Promise((resolveExtract, reject) => {
    // 在子目录里运行的 git archive 只打包那个子目录，所以从 from 运行。
    const archive = spawn("git", ["archive", "--format=tar", commit], {
      cwd: from,
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
