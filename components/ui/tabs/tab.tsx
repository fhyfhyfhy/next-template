"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { use } from "react";

import { cn } from "@/lib/cn";

import { TabsSizeContext } from "./context";
import { tabsTabVariants } from "./variants";

/**
 * 一个 tab，按 `value` 和 TabsRoot 的值比对是否选中，调用方不用自己判断。切换的是页面 URL（比如列表的筛选）时，
 * 传 `nativeButton={false}` 和 `render={<Link href=… />}` 渲染成链接：中键和 Ctrl/Cmd 点击照常在新标签页打开
 * （node_modules/@base-ui/react/docs/react/components/tabs.md 的 Links）。
 */
export function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  const size = use(TabsSizeContext);
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      data-size={size}
      className={cn(tabsTabVariants({ size }), className)}
      {...props}
    />
  );
}
