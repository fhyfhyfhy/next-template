"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/cn";

/**
 * The backdrop behind the popup; its color, opacity and blur can be adjusted on
 * their own.
 */
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
