"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "@/lib/cn";

import { TabsSizeContext } from "./context";
import { tabsListVariants, type TabsSize } from "./variants";

export interface TabsListProps extends TabsPrimitive.List.Props {
  size?: TabsSize;
}

/** 放各个 TabsTab 的底槽，放在 TabsRoot 内；size 统一控制它和里面 tab 的尺寸。用 aria-label 说明这组 tab 在选什么。 */
export function TabsList({ size = "md", className, ...props }: TabsListProps) {
  return (
    <TabsSizeContext value={size}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-size={size}
        className={cn(tabsListVariants({ size }), className)}
        {...props}
      />
    </TabsSizeContext>
  );
}
