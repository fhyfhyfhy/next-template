"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/cn";

/**
 * The popup's description, associated automatically with the content in the
 * same Root.
 */
export function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("mt-2 text-sm/6 text-muted-foreground", className)}
      {...props}
    />
  );
}
