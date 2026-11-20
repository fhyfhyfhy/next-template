"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@/lib/cn";

/**
 * 进度条的填充部分。value 为 null（进度未知）时 Base UI 不设宽度、只标 data-indeterminate，
 * 这里显示为轨道三分之一宽的脉动条，而不是撑满轨道。
 */
export function ProgressIndicator({
  className,
  ...props
}: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      // Base UI 用内联 width 表示进度，所以过渡的是 width；指示条没有子元素，重排只涉及它自己。
      className={cn(
        "h-full rounded-full bg-primary transition-[width] duration-300 ease-out data-indeterminate:w-1/3 data-indeterminate:animate-pulse",
        className,
      )}
      {...props}
    />
  );
}
