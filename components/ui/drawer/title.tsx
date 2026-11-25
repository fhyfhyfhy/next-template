"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

import { cn } from "@/lib/cn";

/** 为同一 Root 内的面板提供可访问名称。 */
export function DrawerTitle({
  className,
  ...props
}: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn(
        "text-lg font-semibold tracking-tight wrap-anywhere",
        className,
      )}
      {...props}
    />
  );
}
