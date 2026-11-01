"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";

import { cn } from "@/lib/cn";

/**
 * Positions the options, keeping Base UI's positioning props and default
 * behavior.
 */
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
