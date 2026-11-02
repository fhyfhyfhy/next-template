import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { loadMessages } from "./messages";
import { routing } from "./routing";

// 只用来补全 next-intl 的配置，屏幕上的内容都不按它格式化：日期和时间按电脑所在时区显示（components/date-time.tsx）。
const TIME_ZONE = "Asia/Shanghai";

/**
 * next-intl 在服务端取 locale、文案和格式化配置时调用（next.config.ts 的 createNextIntlPlugin 指向这里）。
 * 显式传入的 locale（`getTranslations({ locale, namespace })`）不支持时抛错：Server Action 和 Route Handler
 * 读不到 root param，用的是浏览器传来的值，类型约束不了它。没有传入时读 `[locale]` root param。
 */
export default getRequestConfig(async ({ locale }) => {
  if (locale !== undefined) {
    if (!hasLocale(routing.locales, locale)) {
      throw new Error(`Unsupported locale: ${String(locale)}`);
    }
  } else {
    const paramValue = await rootParams.locale();
    // `[locale]` 也会匹配 /unknown.txt 这类路径，不支持的值按 404 处理。
    if (hasLocale(routing.locales, paramValue)) {
      locale = paramValue;
    } else {
      notFound();
    }
  }
  return { locale, messages: await loadMessages(locale), timeZone: TIME_ZONE };
});
