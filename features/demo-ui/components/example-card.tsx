"use client";

import { IconCode, IconEye } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";

import { SourceCode } from "./source-code";

/** 固定场景及其原始使用代码。 */
export function ExampleCard({
  title,
  description,
  source,
  filename,
  children,
}: {
  title: string;
  description: string;
  source: string;
  filename: string;
  children: ReactNode;
}) {
  const t = useTranslations("demo-ui.examples");
  const [showCode, setShowCode] = useState(false);
  return (
    <section className="min-w-0 overflow-hidden rounded-panel border border-border bg-card text-card-foreground">
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div>
          <h3 className="text-base font-medium">{title}</h3>
          <p className="mt-1 text-sm/6 text-muted-foreground">{description}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t(showCode ? "hideCode" : "showCode", { title })}
          aria-expanded={showCode}
          onClick={() => setShowCode(!showCode)}
        >
          {showCode ? <IconEye aria-hidden /> : <IconCode aria-hidden />}
        </Button>
      </div>
      <div className="flex min-h-40 flex-wrap items-center justify-center gap-4 p-6">
        {children}
      </div>
      {showCode && <SourceCode source={source} filename={filename} />}
    </section>
  );
}
