"use client";

import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/** 展示与复制同一份源码；复制失败时保留可手动选择的代码。 */
export function SourceCode({
  source,
  filename,
}: {
  source: string;
  filename: string;
}) {
  const [status, setStatus] = useState("复制代码");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(source);
      setStatus("已复制");
    } catch {
      setStatus("复制失败，请手动选择");
    }
    timer.current = setTimeout(() => setStatus("复制代码"), 2500);
  }
  return (
    <div className="min-w-0 border-t border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <span className="font-mono text-xs text-muted-foreground">
          {filename}
        </span>
        <Button variant="ghost" size="sm" onClick={copy}>
          {status === "已复制" ? (
            <IconCheck aria-hidden />
          ) : (
            <IconCopy aria-hidden />
          )}
          <span aria-live="polite">{status}</span>
        </Button>
      </div>
      <pre
        tabIndex={0}
        aria-label={`${filename} 源码`}
        className="max-h-96 overflow-auto p-5 font-mono text-xs/6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <code>{source}</code>
      </pre>
    </div>
  );
}
