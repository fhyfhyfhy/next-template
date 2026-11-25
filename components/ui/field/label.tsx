"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/cn";

/**
 * 表单里可见 label 的外观。FieldLabel 和 SelectLabel 用它；表单里某一项只显示内容、不放控件时，那一项的标题也用它，
 * 让同一个表单里并排的 label 看起来一致。
 */
export const labelVariants = cva("text-xs font-medium text-muted-foreground");

/** 字段的可见 label，放在 FieldRoot 内，自动关联同一字段的控件，点击它聚焦控件。 */
export function FieldLabel({
  className,
  ...props
}: FieldPrimitive.Label.Props) {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={cn(labelVariants(), className)}
      {...props}
    />
  );
}
