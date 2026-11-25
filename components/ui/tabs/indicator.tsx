"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "@/lib/cn";

/**
 * 选中 tab 底下的白块，放在 TabsList 里、各个 TabsTab 之后。换 tab 时它滑到新的位置：Base UI 把选中 tab 的位置和
 * 尺寸写在 --active-tab-* 上，这里过渡 translate 和宽高。
 */
export function TabsIndicator({
  className,
  ...props
}: TabsPrimitive.Indicator.Props) {
  return (
    <TabsPrimitive.Indicator
      data-slot="tabs-indicator"
      className={cn(
        "absolute top-0 left-0 -z-10 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) rounded-md bg-card shadow-xs transition-[translate,width,height] duration-200 ease-out",
        className,
      )}
      {...props}
    />
  );
}
