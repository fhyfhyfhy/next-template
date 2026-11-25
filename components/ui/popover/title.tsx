"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/cn";

/** 为同一 Root 内的浮层提供可访问名称。 */
export function PopoverTitle({
  className,
  ...props
}: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("text-sm font-semibold wrap-anywhere", className)}
      {...props}
    />
  );
}
