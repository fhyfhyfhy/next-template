"use client";

import { useEffect, useState } from "react";

/** `value` 停止变化 `delayMs` 毫秒后才更新的副本，用于输入停顿后再触发请求或写 URL。 */
export function useDebouncedValue<TValue>(value: TValue, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
