"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * Field.Control 的类型按 input 定义，只取它的 `className`、`style`（都可以是按 Field 状态计算的函数）和
 * `onValueChange`（值变化时收到新的字符串）；渲染的元素固定是 textarea，没有 `render`。
 */
export interface TextareaProps extends Omit<
  ComponentProps<"textarea">,
  "className" | "style"
> {
  className?: FieldPrimitive.Control.Props["className"];
  style?: FieldPrimitive.Control.Props["style"];
  onValueChange?: FieldPrimitive.Control.Props["onValueChange"];
}

/** 多行文本输入；放在 FieldRoot 内时，label、说明、错误和校验状态自动关联。 */
export function Textarea({
  className,
  style,
  id,
  name,
  value,
  defaultValue,
  disabled,
  autoFocus,
  onValueChange,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: TextareaProps) {
  return (
    <FieldPrimitive.Control
      data-slot="textarea"
      // Field.Control 自己处理这几个属性，要传给它：关联 label 的 id、受控与否、和 FieldRoot 合并的 disabled，
      // 拼上 FieldDescription、FieldError id 的 aria-describedby，字段无效时以 Field 为准的 aria-invalid。
      // 其余 textarea 属性放在 render 的元素上，和 Field.Control 的属性、事件、ref 合并；同名时 render 元素上的胜出。
      id={id}
      name={name}
      value={value}
      defaultValue={defaultValue}
      disabled={disabled}
      autoFocus={autoFocus}
      onValueChange={onValueChange}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      style={style}
      render={<textarea {...props} />}
      // 触屏换成 text-base 的原因见 components/ui/input.tsx；aria-invalid:focus-visible:ring-ring 的原因同样见那里。
      className={cn(
        "w-full min-w-0 rounded-control border border-input bg-card px-3 py-2 text-sm text-card-foreground transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-ring pointer-coarse:text-base",
        className,
      )}
    />
  );
}
