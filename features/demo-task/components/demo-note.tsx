import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * Where a Data demo page whose title comes from its data, such as the task
 * detail, says what the page demonstrates and how to try it.
 */
export function DemoNote({ children }: { children: ReactNode }) {
  const t = useTranslations("demo-task.demoNote");
  return (
    <aside
      aria-label={t("label")}
      className="mb-8 max-w-3xl space-y-2 rounded-panel border border-dashed border-border p-4 text-sm/6 text-muted-foreground"
    >
      {children}
    </aside>
  );
}
