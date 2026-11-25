"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "@/lib/cn";

import { menuItemVariants } from "./variants";

/** MenuRadioGroup 里的一个选项，点击后默认不关菜单。调用方在里面放 MenuRadioItemIndicator 标出选中项。 */
export function MenuRadioItem({
  className,
  ...props
}: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="menu-radio-item"
      className={cn(menuItemVariants(), className)}
      {...props}
    />
  );
}
