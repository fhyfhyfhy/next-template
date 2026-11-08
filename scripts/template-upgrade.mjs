import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SAMPLE_PRODUCT } from "./sample-product.mjs";

// 用法：node <next-template 的 checkout>/scripts/template-upgrade.mjs <派生项目的目录>
// 把 next-template 从派生项目的 .template-version 到最新 main 之间的改动带进派生项目，再把 .template-version 改成
// 最新 main（.agents/skills/derived-project/upgrade.md）。只升级到最新 main：这份 checkout 不在 origin/main 上就拒绝，
// 这样用的也总是最新的脚本，派生项目里还没有这个脚本时也能用。只改派生项目的文件，不碰它的 git；要人处理的文件
// 列在报告里。

/**
 * 派生项目里的 derived-project skill 不合并，换成下面的指针：完整的规则和升级流程只看 next-template 本地 checkout
 * 里的最新版，派生项目里不留一份会过时的副本。
 */
const POINTER_DIR = ".agents/skills/derived-project/";
const POINTER = {
  "SKILL.md": `---
name: derived-project
description: How this project relates to next-template, the template it was made from, and how to upgrade it to the template's latest version.
disable-model-invocation: true
---

This project was made from [next-template](https://github.com/fhyfhyfhy/next-template); \`.template-version\` names the template commit it last took in. What the project does with each of the template's files, and how to upgrade it, are in next-template's own \`derived-project\` skill.

Read it in the local next-template checkout that \`git config next-template.path\` names in this repository; when it names none, clone https://github.com/fhyfhyfhy/next-template.git outside the project and set it with \`git config next-template.path <checkout>\`. Pull the checkout to the latest \`main\` with \`git -C <checkout> pull --ff-only\`, then read \`.agents/skills/derived-project/SKILL.md\` there; to upgrade, follow \`upgrade.md\` beside it.
`,
  "agents/openai.yaml": `interface:
  display_name: "Derived project"
  short_description: "Upgrade this project from next-template"
policy:
  allow_implicit_invocation: false
`,
};

/** 派生项目从来不拿的文件：Sample product，以及按 package.json 重新生成的 lockfile。 */
const SKIPPED = (path) =>
  path === "pnpm-lock.yaml" ||
  SAMPLE_PRODUCT.some((prefix) => path.startsWith(prefix));

/**
 * 生成的文件不合并：照模板的版本放，升级后由项目的脚本按它自己的源文件重新生成。内容相近的生成文件也会让 git
 * 把改名配错对，比如把一个组件的 examples.generated.ts 认成另一个组件的。
 */
const GENERATED = /\.generated\.[^/]+$/;

/** git 认定二进制文件的办法：前 8000 个字节里有 NUL。 */
const isBinary = (content) => content.subarray(0, 8000).includes(0);

/**
 * 运行 git，不带调用方的 GIT_* 变量：在 git hook 里，GIT_DIR、GIT_INDEX_FILE 指向触发 hook 的仓库，带上它们，
 * `-C` 就不起作用，git 会读写那个仓库。
 */
const runGit = (args) =>
  spawnSync("git", args, {
    env: Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
    ),
    maxBuffer: 1024 * 1024 * 1024,
  });

/**
 * 把 templateDir 的 HEAD 相对 projectDir/.template-version 的改动带进 projectDir。
 * 两边都改过的文本文件做三方合并，冲突留下冲突标记；没法自动决定的文件不动，记进 `decisions`。
 */
export function upgradeProject({ templateDir, projectDir }) {
  const git = (args) => {
    const result = runGit(["-C", templateDir, ...args]);
    if (result.status !== 0) {
      throw new Error(result.stderr.toString() || `git ${args[0]} failed`);
    }
    return result.stdout;
  };

  const base = readFileSync(
    join(projectDir, ".template-version"),
    "utf8",
  ).trim();
  const target = git(["rev-parse", "HEAD"]).toString().trim();
  git(["fetch", "--quiet", "origin", "main"]);
  const latest = git(["rev-parse", "origin/main"]).toString().trim();
  if (target !== latest) {
    throw new Error(
      `${templateDir} is at ${target.slice(0, 12)}, not the latest main ${latest.slice(0, 12)}; pull it first: git -C ${templateDir} pull --ff-only`,
    );
  }
  if (
    runGit(["-C", templateDir, "cat-file", "-e", `${base}^{commit}`]).status !==
    0
  ) {
    throw new Error(
      `${templateDir} has no commit ${base}, the one .template-version names; fetch next-template's full history`,
    );
  }

  const report = {
    base,
    target,
    added: [],
    merged: [],
    deleted: [],
    renamed: [],
    generated: [],
    conflicts: [],
    decisions: [],
    skipped: [],
  };
  const tempDir = mkdtempSync(join(tmpdir(), "template-upgrade-"));
  const blob = (commit, path) => git(["cat-file", "blob", `${commit}:${path}`]);
  const inProject = (path) => join(projectDir, path);
  const projectFile = (path) =>
    existsSync(inProject(path)) ? readFileSync(inProject(path)) : undefined;

  function write(path, content) {
    mkdirSync(dirname(inProject(path)), { recursive: true });
    writeFileSync(inProject(path), content);
    const [mode] = git(["ls-tree", target, "--", path]).toString().split(" ");
    if (mode === "100755") chmodSync(inProject(path), 0o755);
  }

  /** 项目的版本加上模板从 basePath 到 targetPath 的改动；返回合并结果和冲突数。 */
  function merge(current, basePath, targetPath) {
    const baseContent = blob(base, basePath);
    const targetContent = blob(target, targetPath);
    if (current.equals(baseContent))
      return { content: targetContent, conflicts: 0 };
    if (current.equals(targetContent))
      return { content: current, conflicts: 0 };
    if ([current, baseContent, targetContent].some(isBinary)) {
      return { content: undefined, conflicts: 0 };
    }
    const files = ["project", "base", "target"].map((name) =>
      join(tempDir, name),
    );
    writeFileSync(files[0], current);
    writeFileSync(files[1], baseContent);
    writeFileSync(files[2], targetContent);
    const result = runGit([
      "merge-file",
      "-p",
      "-L",
      "project",
      "-L",
      `next-template ${base.slice(0, 7)}`,
      "-L",
      `next-template ${target.slice(0, 7)}`,
      ...files,
    ]);
    // 退出码是冲突数，出错时为负数（spawnSync 里是大于 127 的值）。
    if (result.status === null || result.status > 127) {
      throw new Error(result.stderr.toString() || "git merge-file failed");
    }
    return { content: result.stdout, conflicts: result.status };
  }

  function take(fromPath, toPath, current) {
    const { content, conflicts } = merge(current, fromPath, toPath);
    if (!content) {
      report.decisions.push({
        path: toPath,
        reason: "binary file that both the template and the project changed",
      });
      return false;
    }
    write(toPath, content);
    if (conflicts > 0) report.conflicts.push(toPath);
    return true;
  }

  const fields = git([
    "diff",
    "--name-status",
    "-z",
    "-M",
    "--no-color",
    "--no-ext-diff",
    base,
    target,
  ])
    .toString()
    .split("\0")
    .filter(Boolean);
  for (let i = 0; i < fields.length;) {
    const status = fields[i++][0];
    const from = fields[i++];
    const path = status === "R" || status === "C" ? fields[i++] : from;
    if (from.startsWith(POINTER_DIR) || path.startsWith(POINTER_DIR)) continue;
    if (SKIPPED(path)) {
      report.skipped.push(path);
      continue;
    }
    if (GENERATED.test(from) || GENERATED.test(path)) {
      if (status === "D") rmSync(inProject(path), { force: true });
      else write(path, blob(target, path));
      if (status === "R") rmSync(inProject(from), { force: true });
      report.generated.push(path);
      continue;
    }
    const current = projectFile(path);

    if (status === "A") {
      if (!current) {
        write(path, blob(target, path));
        report.added.push(path);
      } else if (!current.equals(blob(target, path))) {
        report.decisions.push({
          path,
          reason: "added in the template; the project has its own file here",
        });
      }
    } else if (status === "M") {
      if (!current) {
        report.decisions.push({
          path,
          reason: "changed in the template; the project has deleted it",
        });
      } else if (take(path, path, current)) {
        report.merged.push(path);
      }
    } else if (status === "D") {
      if (!current) continue;
      if (current.equals(blob(base, path))) {
        rmSync(inProject(path));
        report.deleted.push(path);
      } else {
        report.decisions.push({
          path,
          reason: "deleted in the template; the project changed it",
        });
      }
    } else if (status === "R") {
      const old = projectFile(from);
      if (!old) {
        report.decisions.push({
          path,
          reason: `renamed in the template from ${from}, which the project has deleted`,
        });
      } else if (current) {
        report.decisions.push({
          path,
          reason: `renamed in the template from ${from}; the project has both`,
        });
      } else if (take(from, path, old)) {
        rmSync(inProject(from));
        report.renamed.push(`${from} -> ${path}`);
      }
    } else {
      report.decisions.push({ path, reason: `git diff status ${status}` });
    }
  }

  rmSync(tempDir, { recursive: true, force: true });
  rmSync(inProject(POINTER_DIR), { recursive: true, force: true });
  for (const [file, content] of Object.entries(POINTER)) {
    mkdirSync(dirname(inProject(POINTER_DIR + file)), { recursive: true });
    writeFileSync(inProject(POINTER_DIR + file), content);
  }
  writeFileSync(join(projectDir, ".template-version"), `${target}\n`);
  return report;
}

function print(report, templateDir) {
  const short = (sha) => sha.slice(0, 12);
  const diff = `git -C '${templateDir}' diff ${short(report.base)} ${short(report.target)} --`;
  const lines = [
    `Took next-template ${short(report.base)}..${short(report.target)} into the project: ` +
      `${report.merged.length} changed, ${report.added.length} added, ` +
      `${report.deleted.length} deleted, ${report.renamed.length} renamed.`,
    "",
    "Read the template's change to a file with:",
    `  ${diff} <path>`,
  ];
  const section = (title, items) => {
    if (items.length === 0) return;
    lines.push(
      "",
      `${title} (${items.length}):`,
      ...items.map((item) => `  ${item}`),
    );
  };
  section("Renamed", report.renamed);
  section("Conflict markers to resolve", report.conflicts);
  section(
    "Left as they were, for a decision",
    report.decisions.map(({ path, reason }) => `${path}: ${reason}`),
  );
  if (report.generated.length > 0) {
    lines.push(
      "",
      `Generated files taken as the template has them (${report.generated.length}): regenerate them.`,
    );
  }
  const sample = report.skipped.filter((path) => path !== "pnpm-lock.yaml");
  if (sample.length > 0) {
    const paths = SAMPLE_PRODUCT.map((path) => `'${path}'`).join(" ");
    lines.push(
      "",
      `Sample product, not taken (${sample.length}). Read its changes with:`,
      `  ${diff} ${paths}`,
    );
  }
  if (report.skipped.includes("pnpm-lock.yaml")) {
    lines.push("", "pnpm-lock.yaml changed in the template: run pnpm install.");
  }
  console.log(lines.join("\n"));
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [project, ...rest] = process.argv.slice(2);
  if (!project || rest.length > 0) {
    throw new Error(
      "Usage: node <next-template checkout>/scripts/template-upgrade.mjs <project directory>",
    );
  }
  const templateDir = resolve(import.meta.dirname, "..");
  print(
    upgradeProject({ templateDir, projectDir: resolve(project) }),
    templateDir,
  );
}
