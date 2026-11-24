"use client";

import { type RefObject, useEffect } from "react";

interface FocusAfterRetryProps {
  /** 点重试时设为 `true`；挂载时读到它就清掉，焦点丢了才移动。 */
  retriedRef: RefObject<boolean>;
  /** 焦点移到哪里；标题这类原生不能聚焦的元素要加 `tabIndex={-1}`。 */
  targetRef: RefObject<HTMLElement | null>;
}

/**
 * 重试时 Suspense 的 fallback 换掉了刚按的重试按钮，焦点掉到 body。把它放在重试结束时才挂载的地方：重新加载的内容旁
 * （同一个 Suspense 里），和重试又失败时的新提示里。挂载时如果刚点过重试、焦点还在 body 上，就移到 `targetRef`，键盘
 * 用户从这里继续；加载期间用户已经把焦点移到别处，就不拉回来。首次加载没点过重试，不抢焦点。
 */
export function FocusAfterRetry({
  retriedRef,
  targetRef,
}: FocusAfterRetryProps) {
  useEffect(() => {
    if (!retriedRef.current) return;
    retriedRef.current = false;
    const focused = document.activeElement;
    if (focused === null || focused === document.body) {
      targetRef.current?.focus();
    }
  }, [retriedRef, targetRef]);
  return null;
}
