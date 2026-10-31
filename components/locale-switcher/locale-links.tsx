"use client";

import { useSearchParams } from "next/navigation";

import { usePathname } from "@/lib/i18n-navigation";

import { LocaleItems } from "./locale-items";

/** 按当前路径和 query 生成各语言的链接。 */
export function LocaleLinks() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  return <LocaleItems href={query ? `${pathname}?${query}` : pathname} />;
}
