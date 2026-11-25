"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "@/lib/cn";

import { menuItemVariants } from "./variants";

/** 可以勾选的一项，点击后默认不关菜单。调用方在里面放 MenuCheckboxItemIndicator 标出勾选。 */
export function MenuCheckboxItem({
  className,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="menu-checkbox-item"
      className={cn(menuItemVariants(), className)}
      {...props}
    />
  );
}
