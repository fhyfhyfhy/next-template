"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@/lib/cn";

/**
 * 进度条的填充部分。value 为 null（进度未知）时 Base UI 不设宽度、只标 data-indeterminate，
 * 这里显示为轨道三分之一宽、循环滑过轨道的条；减少动效时它静止在轨道正中。
 */
export function ProgressIndicator({
  className,
  ...props
}: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      // Base UI 用内联 width 表示进度，所以过渡的是 width；指示条没有子元素，重排只涉及它自己。
      // 进度未知时，减少动效下 app/globals.css 把动画时长归零，条停在不带动画的 translate-x-full，即轨道正中，
      // 免得静止时像完成了 33%；滑出轨道的部分由 ProgressTrack 的 overflow-hidden 裁掉。
      className={cn(
        "h-full rounded-full bg-primary transition-[width] duration-300 ease-out data-indeterminate:w-1/3 data-indeterminate:translate-x-full data-indeterminate:animate-progress-indeterminate",
        className,
      )}
      {...props}
    />
  );
}
