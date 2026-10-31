"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { cn } from "@/lib/cn";

import { LocaleItems } from "./locale-items";
import { LocaleLinks } from "./locale-links";

interface LocaleSwitcherProps {
  className?: string;
}

/** 在当前页面的各语言版本之间切换，保留路径和 query；选择会记进 `NEXT_LOCALE` cookie。 */
export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const t = useTranslations("ui.localeSwitcher");
  return (
    <nav
      aria-label={t("label")}
      className={cn("flex items-center gap-1 text-xs", className)}
    >
      {/* 链接要读当前 URL 的 query，预渲染时还没有；先显示不可点的语言名，占住同样的位置。 */}
      <Suspense fallback={<LocaleItems />}>
        <LocaleLinks />
      </Suspense>
    </nav>
  );
}
