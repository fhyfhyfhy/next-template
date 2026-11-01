import { defineRouting } from "next-intl/routing";

/**
 * 支持的 locale 和它们的 URL 规则。默认 locale 的 URL 不带前缀，其他 locale 带 `/{locale}` 前缀
 * （docs/adr/0002-locale-routing-as-needed-prefix.md）。加 locale 时要在 `messages/` 下补齐它的全部文件，
 * `messages/messages.test.ts` 会检查。
 */
export const routing = defineRouting({
  locales: ["zh", "en"],
  defaultLocale: "zh",
  localePrefix: "as-needed",
});

/** 写新文案用的语言（GLOSSARY.md 的 Source locale）；messages 的类型和校验都以它为准。 */
export const SOURCE_LOCALE = "zh" satisfies (typeof routing.locales)[number];

export type Locale = (typeof routing.locales)[number];
