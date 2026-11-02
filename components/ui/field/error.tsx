"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";

import { cn } from "@/lib/cn";

/**
 * Shown when the field is invalid. With TanStack Form, pass
 * `match={!field.state.meta.isValid}` and the field's error message as its
 * content.
 */
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
