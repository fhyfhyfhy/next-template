import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** 一列的标题，不换行：`scope="col"` 的 th。 */
export function TableHead({
  scope = "col",
  className,
  ...props
}: ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      scope={scope}
      className={cn(
        "h-9 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-4 last:pr-4",
        className,
      )}
      {...props}
    />
  );
}
