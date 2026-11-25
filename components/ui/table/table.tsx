import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

export interface TableProps extends ComponentProps<"table"> {
  /** 表格的名称。放在外面那层可滚动的 region 上：读屏先读出它，键盘聚焦这层时也读出它。 */
  "aria-label": string;
}

/**
 * 面板上的数据表格：表头在一条灰底上，各行之间有分隔线，比页面宽时横向滚动。里面组合 TableHeader 和由 TableRow
 * 组成的 TableBody；className 给 table，table 占满宽度。外层是放进 Tab 顺序的 region：Safari 不把滚动容器放进
 * Tab 顺序，键盘用户要靠它才能横向滚动。
 */
export function Table({
  "aria-label": label,
  className,
  ...props
}: TableProps) {
  return (
    <div
      data-slot="table-container"
      role="region"
      aria-label={label}
      tabIndex={0}
      className="relative w-full overflow-x-auto rounded-panel border border-border bg-card focus-ring"
    >
      <table
        data-slot="table"
        className={cn(
          "w-full border-collapse text-left text-sm text-card-foreground [&_tbody_tr]:transition-colors [&_tbody_tr]:duration-100 [&_tbody_tr:hover]:bg-muted/40",
          className,
        )}
        {...props}
      />
    </div>
  );
}
