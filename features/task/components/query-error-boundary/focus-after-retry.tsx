"use client";

import { type RefObject, useEffect } from "react";

import { useRetryFocusContext } from "./use-retry-focus-context";

interface FocusAfterRetryProps {
  /** 焦点移到哪里；标题这类原生不能聚焦的元素要加 `tabIndex={-1}`。 */
  targetRef: RefObject<HTMLElement | null>;
}

/**
 * 放在 `QueryErrorBoundary` 里、重新加载的内容旁（同一个 Suspense 里）：重试时 Suspense 的 fallback 换掉了刚按的
 * 重试按钮，焦点掉到 body。挂载时如果刚点过重试、焦点还在 body 上，就移到 `targetRef`，键盘用户从这里继续；加载期间
 * 用户已经把焦点移到别处，就不拉回来。首次加载没点过重试，不抢焦点。重试后边界里先挂载的一个（内容旁的这个，或者
 * 重试又失败时新提示里的那个）取走标志，之后挂载的不再移动焦点。
 */
export function FocusAfterRetry({ targetRef }: FocusAfterRetryProps) {
  const { takeRetried } = useRetryFocusContext();
  useEffect(() => {
    if (!takeRetried()) return;
    const focused = document.activeElement;
    if (focused === null || focused === document.body) {
      targetRef.current?.focus();
    }
  }, [takeRetried, targetRef]);
  return null;
}
