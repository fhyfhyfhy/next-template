"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "@/lib/cn";

/** 和同一 `value` 的 TabsTab 对应的内容，只在那个 tab 选中时显示。Base UI 让它能被 Tab 键聚焦，所以带焦点 ring。 */
export function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn("rounded-control focus-ring", className)}
      {...props}
    />
  );
}
