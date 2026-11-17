"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import type { Ref } from "react";

import { cn } from "@/lib/cn";

/**
 * FieldControl 的类型按 input 定义：这里去掉固定为 textarea 的 `render` 和 input 才有的 `type`，
 * 补上 textarea 的 `rows`，`ref` 指向 textarea 元素。
 */
export interface TextareaProps extends Omit<
  FieldPrimitive.Control.Props,
  "render" | "type" | "ref"
> {
  rows?: number;
  ref?: Ref<HTMLTextAreaElement>;
}

/** 多行文本输入；放在 FieldRoot 内时，label、说明、错误和校验状态自动关联。 */
export function Textarea({ rows, className, ...props }: TextareaProps) {
  return (
    <FieldPrimitive.Control
      data-slot="textarea"
      render={<textarea rows={rows} />}
      // 触屏换成 text-base 的原因见 components/ui/input.tsx。
      className={cn(
        "w-full min-w-0 rounded-control border border-input bg-card px-3 py-2 text-sm text-card-foreground transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus:ring-destructive/15 pointer-coarse:text-base",
        className,
      )}
      {...props}
    />
  );
}
