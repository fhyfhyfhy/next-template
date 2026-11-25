import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** 说明这一行是谁的那一格，比如任务的名称：`scope="row"` 的 th，排版和 TableCell 一样。 */
export function TableRowHeader({
  scope = "row",
  className,
  ...props
}: ComponentProps<"th">) {
  return (
    <th
      data-slot="table-row-header"
      scope={scope}
      className={cn(
        "px-3 py-2.5 text-left align-top font-normal first:pl-4 last:pr-4",
        className,
      )}
      {...props}
    />
  );
}
