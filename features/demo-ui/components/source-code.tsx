"use client";

import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const copyStatusKeys = {
  idle: "copy",
  copied: "copied",
  failed: "copyFailed",
} as const;

/**
 * Shows and copies the same source; when copying fails, the code is still there
 * to select by hand.
 */
export function SourceCode({
  source,
  filename,
}: {
  source: string;
  filename: string;
}) {
  const t = useTranslations("demo-ui.sourceCode");
  const [status, setStatus] = useState<keyof typeof copyStatusKeys>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(source);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    timer.current = setTimeout(() => setStatus("idle"), 2500);
  }
  return (
    <div className="min-w-0 border-t border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <span className="font-mono text-xs text-muted-foreground">
          {filename}
        </span>
        <Button variant="ghost" size="sm" onClick={copy}>
          {status === "copied" ? (
            <IconCheck aria-hidden />
          ) : (
            <IconCopy aria-hidden />
          )}
          <span aria-live="polite">{t(copyStatusKeys[status])}</span>
        </Button>
      </div>
      <pre
        tabIndex={0}
        aria-label={t("label", { filename })}
        className="max-h-96 overflow-auto p-5 font-mono text-xs/6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <code>{source}</code>
      </pre>
    </div>
  );
}
