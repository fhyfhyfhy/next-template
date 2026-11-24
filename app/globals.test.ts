import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const css = readFileSync(new URL("globals.css", import.meta.url), "utf8");

/** 读出一个规则块里每个 CSS 变量的原始值。 */
function variables(selector: string) {
  const block = new RegExp(`^${selector}\\s*\\{([^}]*)\\}`, "m").exec(css)?.[1];
  if (block === undefined) {
    throw new Error(`app/globals.css 里没有 ${selector} 块`);
  }
  return Object.fromEntries(
    Array.from(block.matchAll(/--([\w-]+):\s*([^;]+);/g), ([, name, value]) => [
      name,
      value.trim(),
    ]),
  );
}

// .dark 只写和浅色不同的变量，其余沿用 :root。先合并原始值再解析，.dark 里写成别的格式的颜色不会被浅色值顶替。
const light = variables(":root");
const THEMES = { light, dark: { ...light, ...variables("\\.dark") } };

/** 只认 #rrggbb；oklch()、#rgb、带透明度的写法直接抛错，不拿错的颜色去比。 */
function hexColor(tokens: Record<string, string>, name: string) {
  const value = tokens[name];
  if (value === undefined || !/^#[\da-f]{6}$/i.test(value)) {
    throw new Error(
      `解析不了 --${name}: ${value}；这里只认 #rrggbb，改成这种写法或者扩展 hexColor`,
    );
  }
  return value;
}

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

// [文字色, 它所在的背景色]：每个 foreground 和配对的背景，加上直接写在 background、card、muted 上的次要文字和
// 错误文字，以及写在 background、card 上的 primary 文字（链接、任务名悬停）。背景叠了半透明颜色的搭配在
// BLENDED_PAIRS 里。组件里新出现一种文字色和背景的搭配时，在这里或 BLENDED_PAIRS 里加一项。
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
  ["primary", "background"],
  ["primary", "card"],
] as const;

test.each(Object.entries(THEMES))(
  "%s 主题里文字色和所在背景的对比度达到 WCAG 正文的 4.5:1",
  (_, tokens) => {
    const failures = PAIRS.flatMap(([text, background]) => {
      const ratio = contrast(
        hexColor(tokens, text),
        hexColor(tokens, background),
      );
      return ratio >= 4.5
        ? []
        : [`${text} 在 ${background} 上 ${ratio.toFixed(2)}:1`];
    });
    expect(failures).toStrictEqual([]);
  },
);

/** 把 `overlay` 按 `alpha` 的不透明度叠在 `base` 上，得到实际显示的颜色（Tailwind 的 `bg-<color>/10` 就是这样）。 */
function blend(overlay: string, alpha: number, base: string) {
  const channels = [1, 3, 5].map((index) => {
    const top = Number.parseInt(overlay.slice(index, index + 2), 16);
    const bottom = Number.parseInt(base.slice(index, index + 2), 16);
    return Math.round(top * alpha + bottom * (1 - alpha))
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

// [文字色, 叠上去的颜色, 不透明度, 底下的背景]：导航当前项是 bg-primary/10 叠在页头的 card 或页面的 background 上，
// 文字用 foreground（features/task/components/task-header.tsx、features/ui-catalog/components/component-navigation/link.tsx）。
const BLENDED_PAIRS = [
  ["foreground", "primary", 0.1, "card"],
  ["foreground", "primary", 0.1, "background"],
] as const;

test.each(Object.entries(THEMES))(
  "%s 主题里叠了半透明背景的文字，对比度也达到 4.5:1",
  (_, tokens) => {
    const failures = BLENDED_PAIRS.flatMap(([text, overlay, alpha, base]) => {
      const background = blend(
        hexColor(tokens, overlay),
        alpha,
        hexColor(tokens, base),
      );
      const ratio = contrast(hexColor(tokens, text), background);
      return ratio >= 4.5
        ? []
        : [
            `${text} 在 ${base} 叠 ${overlay}/${alpha * 100} 上 ${ratio.toFixed(2)}:1`,
          ];
    });
    expect(failures).toStrictEqual([]);
  },
);
