"use client";

import { IconArrowUpRight } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { ThemeSelect } from "./theme-select";

interface UiCatalogHeaderProps {
  /** 应用的品牌链接，放在左侧。 */
  brand: ReactNode;
  /** 整个应用共用的操作，比如切换语言，放在主题选择之前。 */
  actions: ReactNode;
}

/** UI catalog 页面顶部的 header，品牌和整个应用共用的操作由调用方传入。 */
export function UiCatalogHeader({ brand, actions }: UiCatalogHeaderProps) {
  const t = useTranslations();
  return (
    <header className="border-b border-border bg-card text-card-foreground">
      <div className="mx-auto flex h-20 max-w-[1600px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        {brand}
        <div className="flex items-center gap-3 sm:gap-6">
          <span className="hidden font-mono text-[11px] tracking-widest text-muted-foreground sm:block">
            {t("ui-catalog.header.tagline")}
          </span>
          <span className="hidden h-5 w-px bg-border sm:block" />
          {actions}
          <ThemeSelect />
          <a
            href="https://base-ui.com/react/overview/quick-start"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1 text-xs text-muted-foreground focus-ring hover:text-foreground sm:flex"
          >
            {t("ui-catalog.header.baseUiDocs")}
            <IconArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </header>
  );
}
