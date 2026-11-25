"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/cn";

/** 提示的定位层，默认在触发器上方、隔开 6px；其余定位参数沿用 Base UI。 */
export function TooltipPositioner({
  sideOffset = 6,
  className,
  ...props
}: TooltipPrimitive.Positioner.Props) {
  return (
    <TooltipPrimitive.Positioner
      data-slot="tooltip-positioner"
      sideOffset={sideOffset}
      className={cn("z-50", className)}
      {...props}
    />
  );
}
