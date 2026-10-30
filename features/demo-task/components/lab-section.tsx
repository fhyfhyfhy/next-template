import { type ReactNode, useId } from "react";

interface LabSectionProps {
  title: string;
  /** 这个实验演示什么、按钮会注入什么故障。 */
  description: ReactNode;
  children: ReactNode;
}

export function LabSection({ title, description, children }: LabSectionProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-panel border border-border bg-card p-5"
    >
      <h2 id={headingId} className="font-medium">
        {title}
      </h2>
      <div className="mt-1 mb-4 text-sm/6 text-muted-foreground">
        {description}
      </div>
      {children}
    </section>
  );
}
