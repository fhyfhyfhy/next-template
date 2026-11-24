"use client";

import { useTranslations } from "next-intl";
import type { Ref } from "react";

import { Button } from "@/components/ui/button";

interface LoadFailedAlertProps {
  /** 失败提示，比如“评论加载失败”。 */
  message: string;
  /**
   * 重试按钮的可访问名称，整句写明重试的是什么，比如“重试加载评论”，同一页上的几个重试按钮才分得清。
   * 要以按钮上看得见的“重试”开头，各语言都一样（messages/messages.test.ts 检查各个 `retryLabel`）。
   */
  retryLabel: string;
  /** 重试按钮的 ref，比如重试后要把焦点放回按钮上。 */
  retryRef?: Ref<HTMLButtonElement>;
  /** 重试进行中：按钮停用但保持可聚焦，键盘焦点留在按钮上。 */
  retrying?: boolean;
  onRetry: () => void;
}

/** 数据首次加载失败、没有内容可显示时的提示和重试按钮，各处的加载失败共用它，样子和读屏读到的说法才一致。 */
export function LoadFailedAlert({
  message,
  retryLabel,
  retryRef,
  retrying,
  onRetry,
}: LoadFailedAlertProps) {
  const t = useTranslations();
  return (
    <div role="alert" className="text-sm">
      <p className="text-destructive">{message}</p>
      <Button
        ref={retryRef}
        variant="outline"
        size="sm"
        className="mt-2"
        aria-label={retryLabel}
        disabled={retrying}
        focusableWhenDisabled
        onClick={onRetry}
      >
        {t("task.queryState.retry")}
      </Button>
    </div>
  );
}
