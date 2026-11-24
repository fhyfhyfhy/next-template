"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { use } from "react";

import { cn } from "@/lib/cn";

import { ProgressFormattedValueContext } from "./context";

/**
 * ProgressRoot 格式化好的进度文字，进度未知时默认不显示；传 children 函数时它收到的也是这个文字（进度未知时为 null）。
 * 读屏不读它（Base UI 设了 aria-hidden，读的是 Root 的 aria-valuetext）。
 */
export function ProgressValue({
  className,
  children,
  ...props
}: ProgressPrimitive.Value.Props) {
  const formattedValue = use(ProgressFormattedValueContext);
  return (
    <ProgressPrimitive.Value
      data-slot="progress-value"
      className={cn("text-sm text-muted-foreground tabular-nums", className)}
      {...props}
    >
      {(_, value) =>
        children ? children(formattedValue, value) : formattedValue
      }
    </ProgressPrimitive.Value>
  );
}
