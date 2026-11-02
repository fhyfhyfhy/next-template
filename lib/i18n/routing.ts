import { defineRouting } from "next-intl/routing";

/**
 * The supported locales and their URL rules. A default-locale URL has no prefix; another locale's
 * has a `/{locale}` prefix (docs/adr/0002-locale-routing-as-needed-prefix.md). A new locale needs
 * all of its files under `messages/`, which `messages/messages.test.ts` checks.
 */
export const routing = defineRouting({
  locales: ["zh", "en"],
  defaultLocale: "zh",
  localePrefix: "as-needed",
});

/** The language new text is written in (Source locale in GLOSSARY.md); the messages' types and checks follow it. */
export const SOURCE_LOCALE = "zh" satisfies (typeof routing.locales)[number];

export type Locale = (typeof routing.locales)[number];
