"use client";

import { useClipboard } from "@mantine/hooks";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

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
  // 状态行显示的那次失败：点复制时清空，下一帧再写入新的 error（每次失败都是新对象），读屏先看到空的状态行，每次失败都重新播报。
  // 不能直接显示 clipboard.error：没有 navigator.clipboard 时 copy() 同步设置 error，和清空合并进同一次渲染，文字不变。
  const [shownError, setShownError] = useState<Error | null>(null);
  useEffect(() => {
    const error = clipboard.error;
    if (!error) return;
    const frame = requestAnimationFrame(() => setShownError(error));
    return () => cancelAnimationFrame(frame);
  }, [clipboard.error]);
  return (
    <div className="min-w-0 border-t border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <span className="font-mono text-xs text-muted-foreground">
          {filename}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-xs text-destructive">
            {shownError && t("ui-catalog.sourceCode.copyFailed")}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShownError(null);
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
