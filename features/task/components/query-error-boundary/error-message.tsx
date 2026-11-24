"use client";

import { useRef } from "react";

import { useQueryErrorResetBoundary } from "@/lib/react-query";

import { LoadFailedAlert } from "../load-failed-alert";
import { FocusAfterRetry } from "./focus-after-retry";
import { useRetryFocusContext } from "./use-retry-focus-context";

export interface QueryErrorBoundaryProps {
  /** 出错时显示的提示，比如“评论加载失败”。 */
  message: string;
  /** 重试按钮的可访问名称，整句，比如“重试加载评论”（见 `LoadFailedAlert`）。 */
  retryLabel: string;
}

interface ErrorMessageProps extends QueryErrorBoundaryProps {
  retry: () => void;
}

export function ErrorMessage({
  message,
  retryLabel,
  retry,
}: ErrorMessageProps) {
  const { reset } = useQueryErrorResetBoundary();
  const { markRetried } = useRetryFocusContext();
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <LoadFailedAlert
        message={message}
        retryLabel={retryLabel}
        retryRef={retryButtonRef}
        onRetry={() => {
          markRetried();
          // 先重置 React Query 的错误边界状态，否则重新挂载的 suspense query 会直接沿用上次的错误。
          reset();
          retry();
        }}
      />
      {/* 重试又失败时，边界新挂载的这条提示把焦点移到新的重试按钮。 */}
      <FocusAfterRetry targetRef={retryButtonRef} />
    </>
  );
}
