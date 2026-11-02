"use client";

import { type DateTimeFormatOptions, useFormatter } from "next-intl";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";

interface DateTimeProps {
  /** 要显示的时刻，Date 或 epoch 毫秒。 */
  value: Date | number;
  /** next-intl 的 `format.dateTime` 选项；时区固定用电脑所在的时区。 */
  format?: Omit<DateTimeFormatOptions, "timeZone">;
  className?: string;
}

/**
 * 按当前 locale 和电脑所在时区显示一个时刻。只有浏览器知道这个时区，所以服务端、以及浏览器 hydrate 页面时，
 * 都把 `<time>` 渲染成空的、占一行高；页面 hydrate 之后文字才出现。客户端导航时直接渲染出来。屏幕上的日期和时间
 * 都经过这里（.claude/rules/i18n.md）。
 */
export function DateTime({ value, format: options, className }: DateTimeProps) {
  const format = useFormatter();
  const timeZone = useSyncExternalStore(subscribe, browserTimeZone, noTimeZone);
  return (
    <time
      dateTime={new Date(value).toISOString()}
      className={cn("inline-block min-h-lh", className)}
    >
      {timeZone && format.dateTime(value, { ...options, timeZone })}
    </time>
  );
}

// 页面打开期间时区不会变。
function subscribe() {
  return () => {};
}

function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function noTimeZone() {
  return null;
}
