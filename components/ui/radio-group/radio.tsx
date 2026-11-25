"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

// default 的尺寸和 CheckboxRoot 一样，并排时对齐；无效时 ring 的写法见 components/ui/checkbox/root.tsx 的说明。
// plain 除了焦点 ring 不画任何外观，由内容用 group-data-checked: 表示是否选中，尺寸由内容决定。
const radioVariants = cva(
  "group shrink-0 data-disabled:cursor-not-allowed data-disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "inline-flex items-center justify-center rounded-full border border-input bg-card focus-ring-offset transition-[border-color] aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/15 aria-invalid:focus-visible:ring-ring data-checked:border-primary aria-invalid:data-checked:border-primary",
        plain: "cursor-pointer rounded-control focus-ring",
      },
      size: { sm: null, md: null, lg: null },
    },
    compoundVariants: [
      { variant: "default", size: "sm", className: "size-4" },
      { variant: "default", size: "md", className: "size-5" },
      { variant: "default", size: "lg", className: "size-6" },
    ],
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface RadioRootProps<Value = string>
  extends
    RadioPrimitive.Root.Props<Value>,
    VariantProps<typeof radioVariants> {}

/**
 * RadioGroup 里的一个选项，按 `value` 区分。`default` 是放 RadioIndicator 的圆形单选框；`plain` 只画里面的内容。
 * 用包裹式 label 或 aria-label 提供名称。
 */
export function RadioRoot<Value = string>({
  variant = "default",
  size = "md",
  className,
  ...props
}: RadioRootProps<Value>) {
  return (
    <RadioPrimitive.Root<Value>
      data-slot="radio"
      data-variant={variant}
      data-size={size}
      className={cn(radioVariants({ variant, size }), className)}
      {...props}
    />
  );
}

/** 选中的 RadioRoot 中间的圆点，只在选中时渲染，大小随 RadioRoot。 */
export function RadioIndicator({
  className,
  ...props
}: RadioPrimitive.Indicator.Props) {
  return (
    <RadioPrimitive.Indicator
      data-slot="radio-indicator"
      className={cn("size-1/2 rounded-full bg-primary", className)}
      {...props}
    />
  );
}
