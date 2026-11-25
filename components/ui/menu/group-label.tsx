"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "@/lib/cn";

/** 给所在的 MenuGroup 或 MenuRadioGroup 命名，比菜单项淡一些。 */
export function MenuGroupLabel({
  className,
  ...props
}: MenuPrimitive.GroupLabel.Props) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="menu-group-label"
      className={cn(
        "px-2.5 pt-1.5 pb-1 text-xs text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
