"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "demo-task:recent";
const MAX_RECENT = 10;
const listeners = new Set<() => void>();

function read(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // 其他标签页写入时也更新。
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function parse(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * 最近查看过的任务 id，存在 localStorage，最新的在前。服务端和 hydration 首轮拿不到 localStorage，
 * 这时返回 `null`，调用方据此推迟依赖它的请求。
 */
export function useRecentTaskIds() {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const ids = raw === null ? null : parse(raw);
  const record = useCallback((taskId: string) => {
    const next = [taskId, ...parse(read()).filter((id) => id !== taskId)];
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(next.slice(0, MAX_RECENT)),
      );
    } catch {
      return;
    }
    for (const listener of listeners) listener();
  }, []);
  return { ids, record };
}
