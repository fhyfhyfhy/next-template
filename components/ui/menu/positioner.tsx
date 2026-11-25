"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "@/lib/cn";

/** 菜单的定位层，默认在触发器下方、隔开 6px；其余定位参数沿用 Base UI。 */
export function MenuPositioner({
  sideOffset = 6,
  className,
  ...props
}: MenuPrimitive.Positioner.Props) {
  return (
    <MenuPrimitive.Positioner
      data-slot="menu-positioner"
      sideOffset={sideOffset}
      className={cn("z-50 outline-none", className)}
      {...props}
    />
  );
}
