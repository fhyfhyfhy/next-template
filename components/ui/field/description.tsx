"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";

import { cn } from "@/lib/cn";

/** 字段的补充说明，放在 FieldRoot 内；同一字段的控件自动用 aria-describedby 指向它。 */
export function FieldDescription({
  className,
  ...props
}: FieldPrimitive.Description.Props) {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}
