"use client";

import { useSearchParams } from "next/navigation";

import { usePathname } from "@/lib/i18n/navigation";

import { LocaleItems } from "./locale-items";

/** Builds each language's link from the current path and query. */
export function LocaleLinks() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  return <LocaleItems href={query ? `${pathname}?${query}` : pathname} />;
}
