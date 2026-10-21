"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/cn";

/** 弹层背景，可单独调整颜色、透明度和模糊效果。 */
export function DialogBackdrop({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      className={cn(
        "fixed inset-0 z-40 bg-overlay backdrop-blur-overlay",
        className,
      )}
      {...props}
    />
  );
}
