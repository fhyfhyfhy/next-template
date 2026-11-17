import { TAILWIND_PALETTES } from "./tailwind-palettes.mjs";

// 颜色只用 app/globals.css 的语义 token 和 black、white，圆角只用内置或 --radius-* token。
// 派生项目在 eslint.config.project.mjs 追加 better-tailwindcss/no-restricted-classes 时，restrict 先展开这个数组：
// 同一规则的选项会整个替换 template 的。
// 名字不以 Class、Classes 结尾，免得 eslint.config.mjs 里 better-tailwindcss 的 selectors 把这里的 pattern 当成 class 检查。
export const TAILWIND_CLASS_RESTRICTIONS = [
  {
    pattern: `^(?:.*:)?!?[a-z-]+-(?:${TAILWIND_PALETTES.join("|")})-\\d+(?:/.+)?!?$`,
    message:
      'Use a semantic color token from app/globals.css instead of the Tailwind palette color "$0".',
  },
  {
    // 任意值里的十六进制色值和颜色函数，只看最后一个方括号里的值，后面只能跟 /不透明度 和 !；url(#id) 和引号里的 #
    // 不算。引用 CSS 变量的写法只拦调色板变量（见下一条）。命名颜色（如 bg-[red]）不查，由 UI review 按
    // components.md「Styles and variants」看。
    // 任意值用 _ 代替空格，_ 属于 \w，所以边界用显式字符集而不是 \b、\w。
    pattern:
      "^.*\\[[^\\]]*(?:(?<!url\\(|['\"])#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z-])|(?<![a-zA-Z-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\()[^\\]]*\\](?:/.+)?!?$",
    message:
      'Define a color token in app/globals.css instead of the hard-coded color in "$0".',
  },
  {
    pattern: `^.*--color-(?:${TAILWIND_PALETTES.join("|")})-\\d+.*$`,
    message:
      'Use a semantic color token from app/globals.css instead of the Tailwind palette variable in "$0".',
  },
  {
    // 只需拦任意值：不是任意值、又不在内置或 --radius-* 主题里的圆角 class 由 no-unknown-classes 报出。
    // rounded-[inherit] 放行：它没有内置写法，shadcn/ui 的 ScrollArea 用它让视口跟随外框圆角。
    pattern: "^(?:.*:)?!?rounded(?:-[a-z]{1,2})?-(?:\\[(?!inherit\\])|\\().*$",
    message:
      'Use a built-in radius or a --radius-* token from app/globals.css instead of "$0".',
  },
  {
    // scale-*、translate-*、rotate-* 设的是各自的 scale、translate、rotate 属性，不是 transform，列表里写 transform 时
    // 它们不过渡。
    pattern:
      "^(?:.*:)?!?transition-\\[(?:[^\\]]*,)?transform(?:,[^\\]]*)?\\]!?$",
    message:
      'scale-*, translate-*, and rotate-* set the scale, translate, and rotate properties, not transform: transition them with transition-transform, or name them in the list, as transition-[opacity,scale], instead of "$0".',
  },
];
