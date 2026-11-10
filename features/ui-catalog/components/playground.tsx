"use client";

import {
  IconAdjustmentsHorizontal,
  IconCode,
  IconRefresh,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { Fragment, type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";

import { SourceCode } from "./source-code";

/**
 * 预览和参数由同一调用方持有状态，并传入 `usePlaygroundConfig` 一并返回的 `source` 和
 * `onReset`，源码随参数一起更新。重置先调用 `onReset`，再重新挂载 `children`，
 * 可调预览自己保存的状态（如 Button 的点击次数）也一并回到初始值。
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
  const t = useTranslations();
  const [showCode, setShowCode] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  return (
    <section
      aria-label={t("ui-catalog.playground.label")}
      className="min-w-0 overflow-hidden rounded-panel border border-border bg-card text-card-foreground"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="size-1.5 rounded-full bg-primary" />
          {t("ui-catalog.playground.preview")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={showCode}
          onClick={() => setShowCode(!showCode)}
        >
          <IconCode aria-hidden />
          {showCode
            ? t("ui-catalog.playground.hideCode")
            : t("ui-catalog.playground.showCode")}
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
            {t("ui-catalog.playground.canvas")}
          </span>
          <div className="w-full max-w-sm">
            <Fragment key={resetCount}>{children}</Fragment>
          </div>
          <span className="absolute bottom-5 left-5 text-xs text-muted-foreground">
            {t("ui-catalog.playground.hint")}
          </span>
        </div>
        <aside
          aria-label={t("ui-catalog.playground.panelLabel")}
          className="border-t border-border bg-background/60 lg:border-t-0 lg:border-l"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="flex items-center gap-2 text-xs font-medium">
              <IconAdjustmentsHorizontal className="size-4" aria-hidden />
              {t("ui-catalog.playground.panelTitle")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onReset();
                setResetCount((count) => count + 1);
              }}
            >
              <IconRefresh aria-hidden />
              {t("ui-catalog.playground.reset")}
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
