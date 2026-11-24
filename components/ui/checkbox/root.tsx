"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

// focus-ring-offset 生成的 CSS 排在所有带 variant 的 class 前面，无效时 aria-invalid:ring-destructive/15 会盖住
// 焦点 ring 的颜色；aria-invalid:focus-visible:ring-ring 让这时的焦点仍是醒目的 ring，不是多余的 class。
const checkboxVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-sm border border-input bg-card text-card-foreground focus-ring-offset transition-[background-color,border-color] aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/15 aria-invalid:focus-visible:ring-ring data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground aria-invalid:data-checked:border-primary data-disabled:cursor-not-allowed data-disabled:opacity-40 data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground aria-invalid:data-indeterminate:border-primary",
  {
    variants: {
      size: {
        sm: "size-4 [&_svg:not([class*='size-'])]:size-3",
        md: "size-5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "size-6 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface CheckboxRootProps
  extends CheckboxPrimitive.Root.Props, VariantProps<typeof checkboxVariants> {}

/** 支持选中和混合状态；使用包裹式 label 或 aria-label 提供名称。 */
export function CheckboxRoot({
  size = "md",
  className,
  ...props
}: CheckboxRootProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      data-size={size}
      className={cn(checkboxVariants({ size }), className)}
      {...props}
    />
  );
}
