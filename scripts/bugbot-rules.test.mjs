import { existsSync, readdirSync } from "node:fs";
import { join, posix } from "node:path";
import { describe, expect, test } from "vitest";

import {
  currentBugbotFiles,
  digestPath,
  DIGESTS_DIR,
  expectedBugbotFiles,
  MAX_FILE_CHARS,
  MAX_LOAD_CHARS,
  projectFiles,
  readText,
  ruleDirectories,
  ruleFiles,
  rulePaths,
  staleDigests,
} from "./bugbot-rules.mjs";

const projectRoot = join(import.meta.dirname, "..");

describe("规则放进哪些目录", () => {
  const files = [
    "proxy.ts",
    "app/page.tsx",
    "app/api/health/route.ts",
    "features/task/api/create-task-action.ts",
    "features/upload/api/upload-action.ts",
    "features/task/server/tasks.ts",
  ];

  test("没有 paths 的规则放在项目根", () => {
    expect(ruleDirectories("r.md", [], files)).toStrictEqual([""]);
  });

  test("glob 截在第一个 ** 处，一份覆盖整棵子树", () => {
    expect(ruleDirectories("r.md", ["app/api/**"], files)).toStrictEqual([
      "app/api",
    ]);
  });

  test("指向文件的 glob 放进每个匹配文件所在的目录", () => {
    expect(
      ruleDirectories("r.md", ["features/*/api/*-action.ts"], files),
    ).toStrictEqual(["features/task/api", "features/upload/api"]);
  });

  test("根目录的文件把规则放在项目根，下面各层不再重复", () => {
    expect(
      ruleDirectories("r.md", ["proxy.ts", "app/api/**"], files),
    ).toStrictEqual([""]);
  });

  test("一个文件都匹配不到的 paths 报错，否则 Bugbot 永远不会读这条规则", () => {
    expect(() => ruleDirectories("r.md", ["nowhere/**"], files)).toThrow(
      "match no file",
    );
  });
});

describe("读规则的 paths", () => {
  test("读块列表写法，引号可有可无", () => {
    const text = '---\npaths:\n  - "app/**"\n  - lib/x.ts\n---\n\n# R\n';
    expect(rulePaths("r.md", text)).toStrictEqual(["app/**", "lib/x.ts"]);
  });

  test("别的写法报错，不当成没有 paths", () => {
    expect(() =>
      rulePaths("r.md", '---\npaths: ["app/**"]\n---\n\n# R\n'),
    ).toThrow("block list");
  });
});

describe("项目里的 BUGBOT.md", () => {
  const expected = expectedBugbotFiles(projectRoot);

  test("和规则、摘要一致：改了规则或摘要后运行 pnpm generate:bugbot", () => {
    expect(currentBugbotFiles(projectRoot)).toStrictEqual(expected);
  });

  test("每份摘要照着它的规则现在的版本写", () => {
    expect(staleDigests(projectRoot)).toStrictEqual([]);
  });

  test("每份摘要都有它的规则", () => {
    const digests = [];
    const walk = (directory) => {
      if (!existsSync(join(projectRoot, directory))) return;
      for (const entry of readdirSync(join(projectRoot, directory), {
        withFileTypes: true,
      })) {
        const path = posix.join(directory, entry.name);
        if (entry.isDirectory()) walk(path);
        else digests.push(path);
      }
    };
    walk(DIGESTS_DIR);
    expect(digests.sort()).toStrictEqual(
      ruleFiles(projectRoot).map(digestPath).sort(),
    );
  });

  test("没有链接：Bugbot 会顺着链接一直读下去，超出它的字数上限", () => {
    for (const [file, content] of Object.entries(expected))
      expect(content, file).not.toMatch(/\]\(/);
    for (const file of ruleFiles(projectRoot).map(digestPath))
      expect(readText(projectRoot, file), file).not.toMatch(/\]\(/);
  });

  test(`单个 BUGBOT.md 不超过 ${MAX_FILE_CHARS} 字符`, () => {
    for (const [file, content] of Object.entries(expected))
      expect(content.length, file).toBeLessThanOrEqual(MAX_FILE_CHARS);
  });

  test(`改动任何一个文件，Bugbot 读到的规则不超过 ${MAX_LOAD_CHARS} 字符`, () => {
    const size = (directory) =>
      expected[posix.join(directory, ".cursor/BUGBOT.md")]?.length ?? 0;
    for (const file of projectFiles(projectRoot)) {
      const parts = posix.dirname(file).split("/");
      let load = size("");
      for (let depth = 1; depth <= parts.length; depth++) {
        const directory = parts.slice(0, depth).join("/");
        if (directory !== ".") load += size(directory);
      }
      expect(load, file).toBeLessThanOrEqual(MAX_LOAD_CHARS);
    }
  });
});
