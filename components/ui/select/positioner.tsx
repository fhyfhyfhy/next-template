"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";

import { cn } from "@/lib/cn";

/** 选项定位层，保留 Base UI 的定位参数和默认行为。 */
export function SelectPositioner({
  className,
  ...props
}: SelectPrimitive.Positioner.Props) {
  return (
    <SelectPrimitive.Positioner
      data-slot="select-positioner"
      className={cn("z-50 outline-none", className)}
      {...props}
    />
  );
}
