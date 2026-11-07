"use client";

import { useQueryStates } from "nuqs";

import { uiCatalogSearchParams } from "../../utils/ui-catalog-search-params";
import { useUiCatalogNavigationContext } from "./use-ui-catalog-navigation-context";

/**
 * 读写 UI catalog 的 URL 状态。示例由 Server Component 按 URL 渲染，所以每次改动都要服务端渲染（`shallow: false`）；
 * 用 push，Back 可以回到上一个组件。导航完成前返回的已经是新的选择。
 */
export function useUiCatalogSearchParams() {
  const { startTransition } = useUiCatalogNavigationContext();
  return useQueryStates(uiCatalogSearchParams, {
    shallow: false,
    history: "push",
    startTransition,
  });
}
