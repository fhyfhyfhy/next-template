"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { cn } from "@/lib/cn";

/** 选中标记，内容和样式由调用方定制。 */
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
