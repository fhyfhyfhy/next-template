"use client";

import { type DateTimeFormatOptions, useFormatter } from "next-intl";

import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/cn";

interface DateTimeProps {
  /** 要显示的时刻，Date 或 epoch 毫秒。 */
  value: Date | number;
  /** next-intl 的 `format.dateTime` 选项；时区固定用电脑所在的时区。 */
  format?: Omit<DateTimeFormatOptions, "timeZone">;
  className?: string;
}

/**
 * 按当前 locale 和电脑所在时区显示一个时刻。只有浏览器知道这个时区，所以 `useHydrated` 为 true 之前
 * `<time>` 渲染成空的、占一行高；客户端导航时直接渲染出来。屏幕上的日期和时间都经过这里（.claude/rules/i18n.md）。
 */
export function DateTime({ value, format: options, className }: DateTimeProps) {
  const format = useFormatter();
  const timeZone = useHydrated()
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : null;
  return (
    <time
      dateTime={new Date(value).toISOString()}
      className={cn("inline-block min-h-lh", className)}
    >
      {timeZone && format.dateTime(value, { ...options, timeZone })}
    </time>
  );
}
