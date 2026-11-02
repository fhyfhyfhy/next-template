import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * A placeholder block shown before content loads. The caller sets its size
 * through className, as close to the loaded content as it can, to avoid layout
 * shift.
 */
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
