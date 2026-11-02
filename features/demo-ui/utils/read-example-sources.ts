import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife } from "next/cache";

import { catalog, type ComponentId } from "../constants/catalog";
import { exampleFiles } from "../constants/example-files.generated";
import type { ExampleSources } from "../types/examples";

/**
 * Reads the source behind each preview, by the generated index. A production
 * deployment must include these source files.
 */
export async function readExampleSources(
  component: ComponentId,
): Promise<ExampleSources> {
  "use cache";
  // The source files change only with a deployment, and the cache key includes
  // the build ID, so every deployment invalidates it.
  cacheLife("max");
  if (!catalog.some((item) => item.id === component))
    throw new Error("Unknown UI demo component");
  const directory = join(
    process.cwd(),
    "features/demo-ui/components",
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
