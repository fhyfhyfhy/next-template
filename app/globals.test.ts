import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const css = readFileSync(new URL("globals.css", import.meta.url), "utf8");

/** 读出一个规则块里用十六进制写的颜色变量。 */
function colorTokens(selector: string) {
  const block = new RegExp(`^${selector}\\s*\\{([^}]*)\\}`, "m").exec(css)?.[1];
  if (block === undefined) {
    throw new Error(`app/globals.css 里没有 ${selector} 块`);
  }
  return Object.fromEntries(
    Array.from(
      block.matchAll(/--([\w-]+):\s*(#[\da-f]{6})\b/gi),
      ([, name, value]) => [name, value],
    ),
  );
}

// .dark 只写和浅色不同的变量，其余沿用 :root。
const light = colorTokens(":root");
const THEMES = { light, dark: { ...light, ...colorTokens("\\.dark") } };

/** WCAG 2 的相对亮度：https://www.w3.org/TR/WCAG22/#dfn-relative-luminance */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

// [文字色, 它所在的背景色]：每个 foreground 和配对的背景，加上直接写在 background、card、muted 上的
// 次要文字和错误文字。组件里新出现一种文字色和背景的搭配时，在这里加一项。
const PAIRS = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["primary-foreground", "primary-hover"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["destructive", "background"],
  ["destructive", "card"],
  ["destructive", "muted"],
] as const;

test.each(Object.entries(THEMES))(
  "%s 主题里文字色和所在背景的对比度达到 WCAG 正文的 4.5:1",
  (_, tokens) => {
    const failures = PAIRS.flatMap(([text, background]) => {
      const ratio = contrast(tokens[text], tokens[background]);
      return ratio >= 4.5
        ? []
        : [`${text} 在 ${background} 上 ${ratio.toFixed(2)}:1`];
    });
    expect(failures).toStrictEqual([]);
  },
);
