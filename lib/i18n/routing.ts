import { defineRouting } from "next-intl/routing";

/**
 * 支持的 locale 和它们的 URL 规则：URL 不带 locale，proxy 按访问者的语言把请求 rewrite 到 `[locale]` 下
 * （docs/adr/0005-unprefixed-urls-in-visitor-locale.md）。加 locale 时要在 `messages/` 下补齐它的全部文件，
 * `messages/messages.test.ts` 会检查。
 */
export const routing = defineRouting({
  locales: ["zh", "en"],
  defaultLocale: "zh",
  localePrefix: "never",
  // 语言切换器做的选择。next-intl 默认写会话 cookie，浏览器一关就忘了；保留一年。
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});

/** 写新文案用的语言（GLOSSARY.md 的 Source locale）；messages 的类型和校验都以它为准。 */
export const SOURCE_LOCALE = "zh" satisfies (typeof routing.locales)[number];

export type Locale = (typeof routing.locales)[number];
