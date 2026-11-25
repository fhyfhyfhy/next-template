"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

import { cn } from "@/lib/cn";

/** 面板说明，与同一 Root 中的面板自动关联。 */
export function DrawerDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn(
        "mt-2 text-sm/6 wrap-anywhere text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
