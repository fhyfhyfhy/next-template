"use client";

import { type DateTimeFormatOptions, useFormatter } from "next-intl";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";

interface DateTimeProps {
  /** The moment to show, as a Date or milliseconds since the epoch. */
  value: Date | number;
  /** next-intl's `format.dateTime` options; the time zone is the computer's. */
  format?: Omit<DateTimeFormatOptions, "timeZone">;
  className?: string;
}

/**
 * A moment in time, in the current locale and the computer's time zone. Only
 * the browser knows that time zone, so the server, and the browser while it
 * hydrates the page, render the `<time>` element empty, a line high; the text
 * appears once the page has hydrated. A client-side navigation renders it at
 * once. Every date and time on screen goes through here
 * (.claude/rules/i18n.md).
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

// The time zone stays the same while the page is open.
function subscribe() {
  return () => {};
}

function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function noTimeZone() {
  return null;
}
