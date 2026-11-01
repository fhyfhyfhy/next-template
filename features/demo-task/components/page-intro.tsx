import type { ReactNode } from "react";

interface PageIntroProps {
  title: string;
  /** What the page demonstrates and how to try it, in a few sentences. */
  children: ReactNode;
}

/** A Data demo page's title and introduction. */
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
