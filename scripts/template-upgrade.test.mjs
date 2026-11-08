import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { upgradeProject } from "./template-upgrade.mjs";

// 一个临时的模板仓库（两个提交：base 和 target）和一个从 base 复制出来、又改过的派生项目。git 不读用户的配置，
// 免得签名、hook 之类的设置影响这里的提交；也不带调用方的 GIT_* 变量：在 git hook 里运行时，GIT_DIR、
// GIT_INDEX_FILE 指向触发 hook 的仓库，带上它们，这里的 init、add、commit 会改到那个仓库。
const root = mkdtempSync(join(tmpdir(), "template-upgrade-test-"));
const templateDir = join(root, "template");
const projectDir = join(root, "project");
const env = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  ),
  GIT_CONFIG_GLOBAL: join(root, "gitconfig"),
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function git(...args) {
  const result = spawnSync("git", ["-C", templateDir, ...args], {
    env,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

function writeFiles(dir, files) {
  for (const [path, content] of Object.entries(files)) {
    if (content === null) {
      rmSync(join(dir, path), { force: true });
      continue;
    }
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
}

function commit(files) {
  writeFiles(templateDir, files);
  git("add", "-A");
  git("commit", "-q", "-m", "commit");
  return git("rev-parse", "HEAD");
}

const lines = (...items) => `${items.join("\n")}\n`;
const read = (path) => readFileSync(join(projectDir, path), "utf8");
const BINARY_BASE = Buffer.from([0, 1, 2]);
const BINARY_TARGET = Buffer.from([0, 1, 3]);

let base;
let target;
let report;

beforeAll(() => {
  writeFileSync(env.GIT_CONFIG_GLOBAL, "");
  mkdirSync(templateDir);
  git("init", "-q", "-b", "main");
  git("init", "-q", "--bare", join(root, "origin.git"));
  git("remote", "add", "origin", join(root, "origin.git"));
  const baseFiles = {
    "only-template.txt": lines("a", "b", "c"),
    "both.txt": lines("a", "b", "c", "d", "e", "f", "g"),
    "conflict.txt": lines("a", "b", "c"),
    "gone.txt": lines("gone"),
    "gone-changed.txt": lines("gone"),
    "old-name.txt": lines("a", "b", "c", "d", "e", "f", "g"),
    "deleted-in-project.txt": lines("a"),
    "image.bin": BINARY_BASE,
    "pnpm-lock.yaml": lines("lock: 1"),
    "features/task/task.ts": lines("task"),
    "old/index.generated.ts": lines("1", "2", "3", "4", "5", "6", "7"),
    ".agents/skills/derived-project/SKILL.md": lines("full skill 1"),
    ".agents/skills/derived-project/upgrade.md": lines("upgrade steps"),
  };
  base = commit(baseFiles);
  target = commit({
    "only-template.txt": lines("a", "B", "c"),
    "both.txt": lines("A", "b", "c", "d", "e", "f", "g"),
    "conflict.txt": lines("a", "template", "c"),
    "gone.txt": null,
    "gone-changed.txt": null,
    "old-name.txt": null,
    "new-name.txt": lines("A", "b", "c", "d", "e", "f", "g"),
    "deleted-in-project.txt": lines("b"),
    "image.bin": BINARY_TARGET,
    "pnpm-lock.yaml": lines("lock: 2"),
    "features/task/task.ts": lines("task 2"),
    "features/task/new.ts": lines("new"),
    "added.txt": lines("added"),
    "own.txt": lines("template's"),
    "old/index.generated.ts": null,
    "new/index.generated.ts": lines("one", "2", "3", "4", "5", "6", "7"),
    ".agents/skills/derived-project/SKILL.md": lines("full skill 2"),
  });
  git("push", "-q", "origin", "main");

  mkdirSync(projectDir);
  writeFiles(projectDir, {
    ...baseFiles,
    ".template-version": `${base}\n`,
    "both.txt": lines("a", "b", "c", "d", "e", "f", "G"),
    "conflict.txt": lines("a", "project", "c"),
    "gone-changed.txt": lines("changed"),
    "old-name.txt": lines("a", "b", "c", "d", "e", "f", "G"),
    "deleted-in-project.txt": null,
    "features/task/task.ts": null,
    "own.txt": lines("project's"),
    "old/index.generated.ts": lines("1", "2", "3", "4", "5", "6", "seven"),
    ".agents/skills/derived-project/SKILL.md": lines("an older pointer"),
    ".agents/skills/derived-project/upgrade.md": null,
  });
  report = upgradeProject({ templateDir, projectDir });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("模板的改动带进派生项目", () => {
  test("只有模板改过的文件换成模板的新版", () => {
    expect(read("only-template.txt")).toBe(lines("a", "B", "c"));
    expect(readFileSync(join(projectDir, "image.bin"))).toStrictEqual(
      BINARY_TARGET,
    );
  });

  test("两边改了不同地方的文件，两边的改动都留下", () => {
    expect(read("both.txt")).toBe(lines("A", "b", "c", "d", "e", "f", "G"));
  });

  test("两边改了同一处的文件留下冲突标记", () => {
    expect(read("conflict.txt")).toContain("<<<<<<< project");
    expect(read("conflict.txt")).toContain("project");
    expect(read("conflict.txt")).toContain("template");
    expect(report.conflicts).toStrictEqual(["conflict.txt"]);
  });

  test("模板新增的文件复制进来，模板删掉的文件跟着删", () => {
    expect(read("added.txt")).toBe(lines("added"));
    expect(existsSync(join(projectDir, "gone.txt"))).toBe(false);
  });

  test("模板改名的文件跟着改名，带上项目自己的改动", () => {
    expect(existsSync(join(projectDir, "old-name.txt"))).toBe(false);
    expect(read("new-name.txt")).toBe(lines("A", "b", "c", "d", "e", "f", "G"));
    expect(report.renamed).toStrictEqual(["old-name.txt -> new-name.txt"]);
  });

  test("生成的文件照模板的版本放，不合并项目的版本", () => {
    expect(existsSync(join(projectDir, "old/index.generated.ts"))).toBe(false);
    expect(read("new/index.generated.ts")).toBe(
      lines("one", "2", "3", "4", "5", "6", "7"),
    );
    expect(report.generated).toStrictEqual(["new/index.generated.ts"]);
  });

  test("derived-project skill 不合并，换成指向本地 next-template 的指针", () => {
    expect(read(".agents/skills/derived-project/SKILL.md")).toContain(
      "git config next-template.path",
    );
    expect(read(".agents/skills/derived-project/agents/openai.yaml")).toContain(
      "allow_implicit_invocation: false",
    );
    expect(
      existsSync(join(projectDir, ".agents/skills/derived-project/upgrade.md")),
    ).toBe(false);
    expect(
      [...report.merged, ...report.decisions.map(({ path }) => path)].filter(
        (path) => path.startsWith(".agents/"),
      ),
    ).toStrictEqual([]);
  });

  test("Sample product 和 lockfile 不带进来", () => {
    expect(existsSync(join(projectDir, "features"))).toBe(false);
    expect(read("pnpm-lock.yaml")).toBe(lines("lock: 1"));
    expect(report.skipped.toSorted()).toStrictEqual([
      "features/task/new.ts",
      "features/task/task.ts",
      "pnpm-lock.yaml",
    ]);
  });

  test("没法自动决定的文件保持原样，列出原因", () => {
    expect(read("gone-changed.txt")).toBe(lines("changed"));
    expect(read("own.txt")).toBe(lines("project's"));
    expect(existsSync(join(projectDir, "deleted-in-project.txt"))).toBe(false);
    expect(report.decisions.map(({ path }) => path).toSorted()).toStrictEqual([
      "deleted-in-project.txt",
      "gone-changed.txt",
      "own.txt",
    ]);
  });

  test(".template-version 改成目标提交", () => {
    expect(read(".template-version")).toBe(`${target}\n`);
  });
});

test("两边都改过的二进制文件保持项目的版本，等人决定", () => {
  const dir = mkdtempSync(join(tmpdir(), "template-upgrade-binary-"));
  writeFiles(dir, {
    ".template-version": `${base}\n`,
    "image.bin": Buffer.from([0, 9, 9]),
  });
  const result = upgradeProject({ templateDir, projectDir: dir });
  expect(readFileSync(join(dir, "image.bin"))).toStrictEqual(
    Buffer.from([0, 9, 9]),
  );
  expect(result.decisions).toContainEqual({
    path: "image.bin",
    reason: "binary file that both the template and the project changed",
  });
  rmSync(dir, { recursive: true, force: true });
});

// 放在最后：它让模板的 checkout 落后于 origin/main。
test("模板的 checkout 不在最新的 main 上就拒绝升级", () => {
  commit({ "later.txt": lines("later") });
  git("push", "-q", "origin", "main");
  git("reset", "-q", "--hard", "HEAD~1");
  const dir = mkdtempSync(join(tmpdir(), "template-upgrade-behind-"));
  writeFiles(dir, { ".template-version": `${base}\n` });
  expect(() => upgradeProject({ templateDir, projectDir: dir })).toThrow(
    /not the latest main/,
  );
  rmSync(dir, { recursive: true, force: true });
});
