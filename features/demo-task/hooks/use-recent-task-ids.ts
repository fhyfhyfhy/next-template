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
  // Also update when another tab writes.
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
 * The ids of recently viewed tasks, stored in localStorage, newest first. The
 * server and the first hydration pass can't read localStorage and get `null`,
 * which tells callers to defer the requests that depend on it. Not
 * `useHydrated`: this also has to follow this page's writes and other tabs'
 * `storage` events, and `useSyncExternalStore`'s server snapshot of `null`
 * doubles as the before-hydration check.
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
