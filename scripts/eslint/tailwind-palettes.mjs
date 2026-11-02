import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The names of the palettes with shades in Tailwind's default theme (red, zinc and so on), read from
 * the installed tailwindcss so that palettes added by an upgrade need no manual sync. black and white
 * have no shades and are not among them.
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
