import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** 一格数据，顶端对齐：内容换行的行也能横着读。 */
export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-3 py-2.5 align-top first:pl-4 last:pr-4", className)}
      {...props}
    />
  );
}
