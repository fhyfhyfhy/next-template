"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const inputVariants = cva(
  "w-full min-w-0 rounded-control border border-input bg-card text-card-foreground transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus:ring-destructive/15",
  {
    variants: {
      size: {
        sm: "h-control-sm px-2.5 text-base sm:text-xs",
        md: "h-control-md px-3 text-base sm:text-sm",
        lg: "h-control-lg px-4 text-base",
      },
    },
    defaultVariants: { size: "md" },
  },
);

/** size 指视觉高度；宽度由调用方通过 className 设置。 */
export interface InputProps
  extends
    Omit<InputPrimitive.Props, "size">,
    VariantProps<typeof inputVariants> {}

/** 文本输入框；调用方提供关联 label 和错误描述。 */
export function Input({ size = "md", className, ...props }: InputProps) {
  return (
    <InputPrimitive
      data-slot="input"
      data-size={size}
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  );
}
