import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { loadMessages } from "./i18n-messages";
import { routing } from "./i18n-routing";

// 服务端渲染和浏览器 hydration 用同一个时区格式化时间，文本才一致。按用户所在时区显示见 TODO.md。
const TIME_ZONE = "Asia/Shanghai";

/**
 * next-intl 在服务端取 locale、文案和格式化配置时调用（next.config.ts 的 createNextIntlPlugin 指向这里）。
 * locale 读自 `[locale]` root param；Server Action 和 Route Handler 读不到 root params，调用方要显式传
 * `getTranslations({ locale, namespace })`，传入的值同样要是支持的 locale。
 */
export default getRequestConfig(async ({ locale: requested }) => {
  const locale = requested ?? (await rootParams.locale());
  // `[locale]` 也会匹配 /unknown.txt 这类路径，不支持的值按 404 处理。
  if (!hasLocale(routing.locales, locale)) notFound();
  return { locale, messages: await loadMessages(locale), timeZone: TIME_ZONE };
});
