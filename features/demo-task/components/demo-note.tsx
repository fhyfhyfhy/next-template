import type { ReactNode } from "react";

/** 标题由页面数据决定的 Data demo 页面（比如任务详情）用它放“这页演示什么、怎么操作”的说明。 */
export function DemoNote({ children }: { children: ReactNode }) {
  return (
    <aside
      aria-label="这页演示什么"
      className="mb-8 max-w-3xl space-y-2 rounded-panel border border-dashed border-border p-4 text-sm/6 text-muted-foreground"
    >
      {children}
    </aside>
  );
}
