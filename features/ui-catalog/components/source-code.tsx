"use client";

import { useClipboard } from "@mantine/hooks";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** 展示与复制同一份源码；复制失败时代码仍可手动选择，按钮旁的状态行提示失败，直到下一次复制。 */
export function SourceCode({
  source,
  filename,
}: {
  source: string;
  filename: string;
}) {
  const t = useTranslations();
  const clipboard = useClipboard({ timeout: 2500 });
  return (
    <div className="min-w-0 border-t border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <span className="font-mono text-xs text-muted-foreground">
          {filename}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-xs text-destructive">
            {clipboard.error && t("ui-catalog.sourceCode.copyFailed")}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // 先清掉上一次的失败提示：再次失败时状态行的文字从无到有，读屏才会重新播报。
              // 失败时 copied 已经是 false，reset 只清掉 error。
              if (clipboard.error) clipboard.reset();
              clipboard.copy(source);
            }}
          >
            {clipboard.copied ? (
              <IconCheck aria-hidden />
            ) : (
              <IconCopy aria-hidden />
            )}
            <span aria-live="polite">
              {t(
                clipboard.copied
                  ? "ui-catalog.sourceCode.copied"
                  : "ui-catalog.sourceCode.copy",
              )}
            </span>
          </Button>
        </div>
      </div>
      {/* 放进 Tab 顺序的 region，键盘也能滚动它；没有 role 的 pre 是 generic，不能带名称。 */}
      <pre
        role="region"
        tabIndex={0}
        aria-label={t("ui-catalog.sourceCode.label", { filename })}
        className="max-h-96 overflow-auto p-5 font-mono text-xs/6 focus-ring"
      >
        <code>{source}</code>
      </pre>
    </div>
  );
}
