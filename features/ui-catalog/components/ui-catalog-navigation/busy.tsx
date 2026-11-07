"use client";

import type { ReactNode } from "react";

import { useUiCatalogNavigationContext } from "./use-ui-catalog-navigation-context";

/** 包住示例：导航期间显示的还是旧组件的示例，标记为更新中并调淡。 */
export function UiCatalogBusy({ children }: { children: ReactNode }) {
  const { isPending } = useUiCatalogNavigationContext();
  return (
    <div
      aria-busy={isPending}
      className="transition-opacity aria-busy:opacity-60"
    >
      {children}
    </div>
  );
}
