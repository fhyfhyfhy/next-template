"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";

import { cn } from "@/lib/cn";

/**
 * The selected value or placeholder, truncated to one line with room left for
 * the trigger icon.
 */
export function SelectValue({
  className,
  ...props
}: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("min-w-0 flex-1 truncate text-left", className)}
      {...props}
    />
  );
}
