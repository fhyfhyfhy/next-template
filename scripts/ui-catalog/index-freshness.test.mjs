import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, onTestFinished, test } from "vitest";

import { generateExampleIndexes } from "./index-generator.mjs";

// 这项检查不写成 ESLint rule（AGENTS.md「Lint tooling」）：rule 同步执行，而生成器要等 Prettier 异步的
// format 才得到生成物该有的内容，rule 里只能另起 worker 阻塞等待。它不 import 示例文件，vitest related 选不到它，
// 由 lint-staged.config.mjs 在 features/ui-catalog/ 有改动时单独跑。

const featurePath = "features/ui-catalog";
const project = fileURLToPath(new URL("../..", import.meta.url));

test("仓库里的生成索引和 *-examples 源文件一致", async () => {
  // 副本放在项目里而不是系统临时目录：Prettier 按生成物的位置找配置，这样才和仓库里的生成物用同一份配置格式化。
  const cache = join(project, "node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  const root = mkdtempSync(join(cache, "ui-catalog-indexes-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(project, featurePath), join(root, featurePath), {
    recursive: true,
  });

  expect(
    (await generateExampleIndexes(root)).map((file) => relative(root, file)),
    "生成索引过期：运行 pnpm generate:examples，并提交它更新的文件",
  ).toStrictEqual([]);
});
