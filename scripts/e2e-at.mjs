import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Usage: pnpm e2e:at <commit> [playwright test args]
// Tests <commit>'s app code with this checkout's e2e/ and Playwright config, to confirm that a spec
// written for a bug fails on the commit before the fix (Regression specs in .claude/rules/e2e.md).
// The ports come from E2E_PORT, DEMO_E2E_PORT and the like, as usual.

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

// Swaps in the current specs and config: the specs under test are the ones written now, which an old
// commit may not have.
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

/** Pipes `git archive`'s tar stream straight into tar to unpack; Windows has shipped tar since Windows 10. */
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

/** pnpm has a JS entry and, since pnpm 12, a native executable; it runs whichever one `npm_execpath` points to. */
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
