"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const dialogPopupVariants = cva(
  "fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel border border-border bg-popover p-6 text-popover-foreground shadow-popover outline-none sm:p-8",
  {
    variants: { size: { sm: "max-w-sm", md: "max-w-md", lg: "max-w-xl" } },
    defaultVariants: { size: "md" },
  },
);

export interface DialogPopupProps
  extends
    DialogPrimitive.Popup.Props,
    VariantProps<typeof dialogPopupVariants> {}

/** 弹层内容；调用方组合 Title、Description 和可访问的 Close。 */
export function DialogPopup({
  size = "md",
  className,
  ...props
}: DialogPopupProps) {
  return (
    <DialogPrimitive.Popup
      data-slot="dialog-popup"
      data-size={size}
      className={cn(dialogPopupVariants({ size }), className)}
      {...props}
    />
  );
}
