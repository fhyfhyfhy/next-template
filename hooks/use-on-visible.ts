"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * 元素进入视口时调用 `onVisible`，返回挂到元素上的 ref callback。元素一直留在视口里时不会重复调用，
 * 离开再进入才会再次调用；需要连续加载的调用方在数据变化后自行判断。
 */
export function useOnVisible<TElement extends Element>(onVisible: () => void) {
  const latest = useRef(onVisible);
  useLayoutEffect(() => {
    latest.current = onVisible;
  });
  return useCallback((node: TElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) latest.current();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
}
