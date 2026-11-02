"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";

import { cn } from "@/lib/cn";

export type FieldRootProps = FieldPrimitive.Root.Props;

/**
 * A form field whose label, control and error are associated automatically.
 * With TanStack Form, pass `invalid`, `dirty` and `touched` from the field's
 * state.
 */
export function FieldRoot({ className, ...props }: FieldRootProps) {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  );
}
