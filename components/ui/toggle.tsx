"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

// 按下时的底色是 accent，和焦点 ring 的颜色不会连成一片，所以用不带间隙的 focus-ring。
const toggleVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control border font-medium whitespace-nowrap focus-ring transition-[background-color,color,border-color,box-shadow] duration-150 not-data-disabled:hover:bg-muted not-data-disabled:hover:text-foreground data-disabled:cursor-not-allowed data-disabled:opacity-40 data-pressed:bg-accent data-pressed:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-transparent bg-transparent",
        outline: "border-input bg-card",
      },
      size: {
        sm: "h-control-sm min-w-control-sm px-2 text-xs",
        md: "h-control-md min-w-control-md px-2.5 text-sm",
        lg: "h-control-lg min-w-control-lg px-3 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ToggleProps<Value extends string = string>
  extends TogglePrimitive.Props<Value>, VariantProps<typeof toggleVariants> {}

/** 按下或弹起两种状态的按钮，比如一个格式选项。名称由调用方给出，需要保存的状态由调用方持有。 */
export function Toggle<Value extends string = string>({
  variant = "default",
  size = "md",
  className,
  ...props
}: ToggleProps<Value>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      data-variant={variant}
      data-size={size}
      className={cn(toggleVariants({ variant, size }), className)}
      {...props}
    />
  );
}
