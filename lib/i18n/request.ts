import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { loadMessages } from "./messages";
import { routing } from "./routing";

// Only completes next-intl's config: nothing on screen is formatted in it.
// Dates and times show in the computer's time zone (components/date-time.tsx).
const TIME_ZONE = "Asia/Shanghai";

/**
 * Called when next-intl gets the locale, messages and formatting config on the server (next.config.ts's
 * createNextIntlPlugin points here). An explicitly passed locale (`getTranslations({ locale, namespace })`)
 * is used as it is, unchecked here: its type is already `Locale`, and a caller passing a value from the
 * client checks it with `hasLocale` first, as `createTaskAction` does. Without one, the `[locale]` root
 * param is read.
 */
export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const paramValue = await rootParams.locale();
    // `[locale]` also matches paths such as /unknown.txt; an unsupported value is a 404.
    if (hasLocale(routing.locales, paramValue)) {
      locale = paramValue;
    } else {
      notFound();
    }
  }
  return { locale, messages: await loadMessages(locale), timeZone: TIME_ZONE };
});
