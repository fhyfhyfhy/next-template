"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/cn";

/** 浮层的定位层，默认在触发器下方、隔开 6px；其余定位参数沿用 Base UI。 */
export function PopoverPositioner({
  sideOffset = 6,
  className,
  ...props
}: PopoverPrimitive.Positioner.Props) {
  return (
    <PopoverPrimitive.Positioner
      data-slot="popover-positioner"
      sideOffset={sideOffset}
      className={cn("z-50 outline-none", className)}
      {...props}
    />
  );
}
