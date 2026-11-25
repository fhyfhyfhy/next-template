"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/cn";

/**
 * 浮层面板，放在调用方提供的 Positioner 内，Title、Description 和内容由调用方组合。从触发器那一侧放大、淡入，
 * 高宽不超出视口留给它的空间，放不下时滚动。
 */
export function PopoverPopup({
  className,
  ...props
}: PopoverPrimitive.Popup.Props) {
  return (
    <PopoverPrimitive.Popup
      data-slot="popover-popup"
      className={cn(
        "max-h-(--available-height) w-72 max-w-(--available-width) origin-(--transform-origin) overflow-y-auto rounded-panel border border-border bg-popover p-4 text-sm text-popover-foreground shadow-popover transition-[opacity,scale] duration-150 ease-out outline-none data-ending-style:scale-97 data-ending-style:opacity-0 data-starting-style:scale-97 data-starting-style:opacity-0",
        className,
      )}
      {...props}
    />
  );
}
