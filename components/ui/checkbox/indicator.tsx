"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { cn } from "@/lib/cn";

/** The check mark; the caller customizes its content and style. */
export function CheckboxIndicator({
  className,
  ...props
}: CheckboxPrimitive.Indicator.Props) {
  return (
    <CheckboxPrimitive.Indicator
      data-slot="checkbox-indicator"
      className={cn("flex items-center justify-center", className)}
      {...props}
    />
  );
}
