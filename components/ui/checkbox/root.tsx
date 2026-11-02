"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const checkboxVariants = cva(
  "group inline-flex shrink-0 items-center justify-center rounded-sm border border-input bg-card text-card-foreground transition-[background-color,border-color] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/15 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground aria-invalid:data-checked:border-primary data-disabled:cursor-not-allowed data-disabled:opacity-40 data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground aria-invalid:data-indeterminate:border-primary",
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

/**
 * Supports checked and indeterminate states. Name it with a wrapping label or
 * aria-label.
 */
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
