"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { cn } from "@/lib/cn";

import { LocaleItems } from "./locale-items";
import { LocaleLinks } from "./locale-links";

interface LocaleSwitcherProps {
  className?: string;
}

/**
 * Switches between the language versions of the current page, keeping the path
 * and query. The choice is stored in the `NEXT_LOCALE` cookie.
 */
export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const t = useTranslations("ui.localeSwitcher");
  return (
    <nav
      aria-label={t("label")}
      className={cn("flex items-center gap-1 text-xs", className)}
    >
      {/* The links read the current URL's query, which prerendering doesn't
          have; until then, unclickable language names hold the same space. */}
      <Suspense fallback={<LocaleItems />}>
        <LocaleLinks />
      </Suspense>
    </nav>
  );
}
