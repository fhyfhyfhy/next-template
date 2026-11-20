"use client";

import { useClipboard } from "@mantine/hooks";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** 展示与复制同一份源码；复制失败时代码仍可手动选择，按钮上的失败提示保留到下一次复制。 */
export function SourceCode({
  source,
  filename,
}: {
  source: string;
  filename: string;
}) {
  const t = useTranslations();
  const clipboard = useClipboard({ timeout: 2500 });
  const status = clipboard.copied
    ? "copied"
    : clipboard.error
      ? "copyFailed"
      : "copy";
  return (
    <div className="min-w-0 border-t border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <span className="font-mono text-xs text-muted-foreground">
          {filename}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => clipboard.copy(source)}
        >
          {clipboard.copied ? (
            <IconCheck aria-hidden />
          ) : (
            <IconCopy aria-hidden />
          )}
          <span aria-live="polite">{t(`ui-catalog.sourceCode.${status}`)}</span>
        </Button>
      </div>
      {/* 放进 Tab 顺序的 region，键盘也能滚动它；没有 role 的 pre 是 generic，不能带名称。 */}
      <pre
        role="region"
        tabIndex={0}
        aria-label={t("ui-catalog.sourceCode.label", { filename })}
        className="max-h-96 overflow-auto p-5 font-mono text-xs/6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <code>{source}</code>
      </pre>
    </div>
  );
}
