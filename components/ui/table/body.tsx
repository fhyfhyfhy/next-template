import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** 表格的各行；最后一行下面不画分隔线，由面板的边框收住。 */
export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}
