"use client";

import { type ReactNode, useTransition } from "react";

import { UiCatalogNavigationContext } from "./context";

/**
 * 组件目录和示例共享的导航 transition，包住两者。换组件要等服务端渲染新组件的示例：nuqs 让新的一项立即高亮，
 * 旧示例在 transition 结束前标记为更新中。
 */
export function UiCatalogNavigation({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();
  return (
    <UiCatalogNavigationContext value={{ isPending, startTransition }}>
      {children}
    </UiCatalogNavigationContext>
  );
}
