import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Tailwind 默认主题里带色阶的调色板名（red、zinc 等），从安装的 tailwindcss 读取，
 * 升级新增调色板时不用手动同步。black、white 没有色阶，不在其中。
 */
export const TAILWIND_PALETTES = [
  ...new Set(
    Array.from(
      readFileSync(
        fileURLToPath(import.meta.resolve("tailwindcss/theme.css")),
        "utf8",
      ).matchAll(/--color-([a-z]+)-\d+:/g),
      ([, name]) => name,
    ),
  ),
];
