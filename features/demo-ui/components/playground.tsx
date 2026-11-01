"use client";

import {
  IconAdjustmentsHorizontal,
  IconCode,
  IconRefresh,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";

import { SourceCode } from "./source-code";

/**
 * One caller holds the state of the preview and the controls, so the source
 * updates with the config.
 */
export function Playground({
  children,
  controls,
  source,
  onReset,
}: {
  children: ReactNode;
  controls: ReactNode;
  source: string;
  onReset: () => void;
}) {
  const t = useTranslations("demo-ui.playground");
  const [showCode, setShowCode] = useState(false);
  return (
    <section
      aria-label={t("label")}
      className="min-w-0 overflow-hidden rounded-panel border border-border bg-card text-card-foreground"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="size-1.5 rounded-full bg-primary" />
          {t("preview")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={showCode}
          onClick={() => setShowCode(!showCode)}
        >
          <IconCode aria-hidden />
          {showCode ? t("hideCode") : t("showCode")}
        </Button>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_264px]">
        <div
          className="relative flex min-h-72 min-w-0 items-center justify-center overflow-hidden p-8 sm:min-h-96"
          style={{
            backgroundImage:
              "radial-gradient(var(--border) 0.7px, transparent 0.7px)",
            backgroundSize: "18px 18px",
          }}
        >
          <span className="absolute top-5 left-5 font-mono text-[10px] tracking-widest text-muted-foreground">
            {t("canvas")}
          </span>
          <div className="w-full max-w-sm">{children}</div>
          <span className="absolute bottom-5 left-5 text-xs text-muted-foreground">
            {t("hint")}
          </span>
        </div>
        <aside
          aria-label={t("panelLabel")}
          className="border-t border-border bg-background/60 lg:border-t-0 lg:border-l"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="flex items-center gap-2 text-xs font-medium">
              <IconAdjustmentsHorizontal className="size-4" aria-hidden />
              {t("panelTitle")}
            </span>
            <Button variant="ghost" size="sm" onClick={onReset}>
              <IconRefresh aria-hidden />
              {t("reset")}
            </Button>
          </div>
          <div className="grid gap-5 p-5 sm:grid-cols-2 lg:max-h-130 lg:grid-cols-1 lg:overflow-y-auto">
            {controls}
          </div>
        </aside>
      </div>
      {showCode && <SourceCode source={source} filename="playground.tsx" />}
    </section>
  );
}
