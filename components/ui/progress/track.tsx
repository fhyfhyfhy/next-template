"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@/lib/cn";

/** 进度条的轨道，占满 Root 的整行，里面放 ProgressIndicator。 */
export function ProgressTrack({
  className,
  ...props
}: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      data-slot="progress-track"
      className={cn(
        "col-span-full h-2 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
      {...props}
    />
  );
}
