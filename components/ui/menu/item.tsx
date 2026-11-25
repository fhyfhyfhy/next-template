"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "@/lib/cn";

import { menuItemVariants } from "./variants";

/** 一个操作，点击后默认关上菜单（closeOnClick）。 */
export function MenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      className={cn(menuItemVariants(), className)}
      {...props}
    />
  );
}
