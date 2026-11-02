import type { ReactNode } from "react";

interface PageIntroProps {
  title: string;
  /** 这页演示了什么、怎么操作，几句话即可。 */
  children: ReactNode;
}

/** Data demo 页面的标题和说明。 */
export function PageIntro({ title, children }: PageIntroProps) {
  return (
    <div className="mb-8">
      <h1 className="text-4xl font-medium tracking-[-0.04em] sm:text-5xl">
        {title}
        <span className="text-primary">.</span>
      </h1>
      <div className="mt-4 max-w-3xl space-y-2 text-sm/6 text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
