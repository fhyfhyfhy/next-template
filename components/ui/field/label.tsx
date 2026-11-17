"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";

import { cn } from "@/lib/cn";

/** 字段的可见 label，放在 FieldRoot 内，自动关联同一字段的控件，点击它聚焦控件。 */
export function FieldLabel({
  className,
  ...props
}: FieldPrimitive.Label.Props) {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={cn("text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}
