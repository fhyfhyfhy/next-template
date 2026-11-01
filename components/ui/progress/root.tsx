"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@/lib/cn";

/**
 * The progress of a long-running operation; a null `value` means the progress
 * is unknown. The caller composes Label, Value and Track.
 */
export function ProgressRoot({
  className,
  ...props
}: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2",
        className,
      )}
      {...props}
    />
  );
}
