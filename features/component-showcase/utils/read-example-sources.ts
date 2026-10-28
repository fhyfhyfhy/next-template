import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife } from "next/cache";

import { catalog, type ComponentId } from "../constants/catalog";
import { exampleFiles } from "../constants/example-files.generated";
import type { ExampleSources } from "../types/examples";

/** 按生成索引读取预览对应的源码；生产部署需包含这些源文件。 */
export async function readExampleSources(
  component: ComponentId,
): Promise<ExampleSources> {
  "use cache";
  // 源文件只随部署变化，而缓存 key 含 build id，每次部署自动失效。
  cacheLife("max");
  if (!catalog.some((item) => item.id === component))
    throw new Error("Unknown showcase component");
  const directory = join(
    process.cwd(),
    "features/component-showcase/components",
    `${component}-examples`,
  );
  const [playground, examples] = await Promise.all([
    readFile(join(directory, "playground.tsx"), "utf8"),
    Promise.all(
      exampleFiles[component].map(async ({ id, filename }) => [
        id,
        await readFile(join(directory, filename), "utf8"),
      ]),
    ),
  ]);
  return { playground, examples: Object.fromEntries(examples) };
}
