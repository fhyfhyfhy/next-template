"use client";

import { type RefObject, useRef } from "react";

import { useQueryErrorResetBoundary } from "@/lib/react-query";

import { FocusAfterRetry } from "../focus-after-retry";
import { LoadFailedAlert } from "../load-failed-alert";

export interface QueryErrorBoundaryProps {
  /** 出错时显示的提示，比如“评论加载失败”。 */
  message: string;
  /** 重试按钮的可访问名称，整句，比如“重试加载评论”（见 `LoadFailedAlert`）。 */
  retryLabel: string;
  /**
   * 点重试时同步设为 `true`，早于边界重新渲染内容。重试又失败时，边界新挂载的提示读它，把焦点放到新的重试按钮上；
   * 重试成功时由调用方放在内容旁的 `FocusAfterRetry` 读它。
   */
  retriedRef: RefObject<boolean>;
}

interface ErrorMessageProps extends QueryErrorBoundaryProps {
  retry: () => void;
}

export function ErrorMessage({
  message,
  retryLabel,
  retriedRef,
  retry,
}: ErrorMessageProps) {
  const { reset } = useQueryErrorResetBoundary();
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <LoadFailedAlert
        message={message}
        retryLabel={retryLabel}
        retryRef={retryButtonRef}
        onRetry={() => {
          retriedRef.current = true;
          // 先重置 React Query 的错误边界状态，否则重新挂载的 suspense query 会直接沿用上次的错误。
          reset();
          retry();
        }}
      />
      <FocusAfterRetry retriedRef={retriedRef} targetRef={retryButtonRef} />
    </>
  );
}
