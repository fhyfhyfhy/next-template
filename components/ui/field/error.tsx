"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";

import { cn } from "@/lib/cn";

/** 字段无效时显示。配合 TanStack Form 时传 `match={!field.state.meta.isValid}`，内容是字段的错误文案。 */
export function FieldError({
  className,
  ...props
}: FieldPrimitive.Error.Props) {
  return (
    <FieldPrimitive.Error
      data-slot="field-error"
      className={cn("text-xs text-destructive", className)}
      {...props}
    />
  );
}
