"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const switchVariants = cva(
  "group/switch relative inline-flex shrink-0 items-center rounded-full bg-switch-track p-0.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-40",
  {
    variants: {
      size: {
        sm: "h-5 w-9",
        md: "h-6 w-11",
        lg: "h-7 w-13",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface SwitchRootProps
  extends SwitchPrimitive.Root.Props, VariantProps<typeof switchVariants> {}

/**
 * A switch that takes effect at once; the caller provides the label and any
 * state that needs persisting.
 */
export function SwitchRoot({
  size = "md",
  className,
  ...props
}: SwitchRootProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(switchVariants({ size }), className)}
      {...props}
    />
  );
}
