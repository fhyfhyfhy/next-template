import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import nextTs from "eslint-config-next/typescript";
import { onTestFinished } from "vitest";

/** Next 的 ESLint 配置用的 TypeScript parser，给用自己的配置 lint 的测试用。 */
export const { parser } = nextTs.find(
  (config) => config.languageOptions?.parser,
).languageOptions;

/** 把 `source` 写到 root 下的 `file`，目录不存在时创建。 */
export function writeFile(root, file, source) {
  const filename = join(root, file);
  mkdirSync(dirname(filename), { recursive: true });
  writeFileSync(filename, source, "utf8");
}

/**
 * 在新的临时目录里写一个项目，返回这个目录；当前测试结束时目录被删除，所以要在测试里调用。项目带一个
 * tsconfig.json，按 bundler 的方式解析并带 `@/*` 别名，compilerOptions 可用 `compilerOptions` 扩展；
 * `files` 是路径到源码的映射，其中的 tsconfig.json 会替换默认的那份，源码为 null 的文件不写。
 */
export function fixture(files = {}, compilerOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), "eslint-fixture-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const tsconfig = {
    compilerOptions: {
      module: "esnext",
      moduleResolution: "bundler",
      paths: { "@/*": ["./*"] },
      ...compilerOptions,
    },
  };
  for (const [file, source] of Object.entries({
    "tsconfig.json": JSON.stringify(tsconfig),
    ...files,
  })) {
    if (source !== null) writeFile(root, file, source);
  }
  return root;
}
