"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@/lib/cn";

/** 任务进度；`value` 为 null 时表示进度未知。调用方组合 Label、Value 和 Track。 */
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
