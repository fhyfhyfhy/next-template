"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/cn";

/** 浮层说明，与同一 Root 中的浮层自动关联。 */
export function PopoverDescription({
  className,
  ...props
}: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("mt-1 wrap-anywhere text-muted-foreground", className)}
      {...props}
    />
  );
}
