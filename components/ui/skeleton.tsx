import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** 内容加载前的占位块；尺寸由调用方通过 className 设置，尽量和加载后的内容一致，避免布局跳动。 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-control bg-muted", className)}
      {...props}
    />
  );
}
