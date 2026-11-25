"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "@/lib/cn";

/** 菜单面板，放在调用方提供的 Positioner 内。从触发器那一侧放大、淡入，高度不超出视口留给它的空间，放不下时滚动。 */
export function MenuPopup({ className, ...props }: MenuPrimitive.Popup.Props) {
  return (
    <MenuPrimitive.Popup
      data-slot="menu-popup"
      className={cn(
        "max-h-(--available-height) min-w-44 origin-(--transform-origin) overflow-y-auto rounded-panel border border-border bg-popover p-1 text-sm text-popover-foreground shadow-popover transition-[opacity,scale] duration-150 ease-out outline-none data-ending-style:scale-97 data-ending-style:opacity-0 data-starting-style:scale-97 data-starting-style:opacity-0",
        className,
      )}
      {...props}
    />
  );
}
