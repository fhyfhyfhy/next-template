import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** 一行，和下一行之间有分隔线。 */
export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn("border-b border-border", className)}
      {...props}
    />
  );
}
