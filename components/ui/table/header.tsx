import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** 表头，一行 TableHead，放在一条灰底上。 */
export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-muted/60 [&_tr]:border-b", className)}
      {...props}
    />
  );
}
