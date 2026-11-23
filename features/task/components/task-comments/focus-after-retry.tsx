"use client";

import { type RefObject, useEffect } from "react";

interface FocusAfterRetryProps {
  /** 点重试时设为 `true`；挂载时读到它就移动焦点，再清掉。 */
  retriedRef: RefObject<boolean>;
  /** 焦点移到哪里，需要 `tabIndex={-1}` 才能接受焦点。 */
  targetRef: RefObject<HTMLElement | null>;
}

/**
 * 放在 Suspense 里、和重新加载的内容并列：内容显示出来时它才挂载，这时如果刚点过重试，就把焦点移到 `targetRef`。
 * 首次加载没点过重试，不抢焦点。
 */
export function FocusAfterRetry({
  retriedRef,
  targetRef,
}: FocusAfterRetryProps) {
  useEffect(() => {
    if (!retriedRef.current) return;
    retriedRef.current = false;
    targetRef.current?.focus();
  }, [retriedRef, targetRef]);
  return null;
}
