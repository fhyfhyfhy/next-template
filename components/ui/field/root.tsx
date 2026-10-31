"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";

import { cn } from "@/lib/cn";

export type FieldRootProps = FieldPrimitive.Root.Props;

/** 一个表单字段，里面的 label、控件和错误自动关联。配合 TanStack Form 时，`invalid`、`dirty`、`touched` 从字段状态传入。 */
export function FieldRoot({ className, ...props }: FieldRootProps) {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  );
}
