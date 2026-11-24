"use client";

import { useTranslations } from "next-intl";
import { Suspense, useRef } from "react";

import { FocusAfterRetry } from "../focus-after-retry";
import { QueryErrorBoundary } from "../query-error-boundary";
import { CommentForm } from "./comment-form";
import { CommentList } from "./comment-list";

/** 评论只在详情页显示，由 React Query 负责；服务端以 pending 状态 dehydrate，数据到了再流式出现。 */
export function TaskComments({ taskId }: { taskId: string }) {
  const t = useTranslations();
  const headingRef = useRef<HTMLHeadingElement>(null);
  // 重试后焦点的去处（FocusAfterRetry）：评论显示出来时移到标题，又失败时由错误边界移到新的重试按钮。
  const retriedRef = useRef(false);
  return (
    <section>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mb-3 text-sm font-medium focus-ring"
      >
        {t("task.comments.title")}
      </h2>
      <QueryErrorBoundary
        message={t("task.comments.loadFailed")}
        retryLabel={t("task.comments.retryLabel")}
        retriedRef={retriedRef}
      >
        <Suspense
          fallback={
            <p className="text-sm text-muted-foreground">
              {t("task.comments.loading")}
            </p>
          }
        >
          <CommentList taskId={taskId} />
          <FocusAfterRetry retriedRef={retriedRef} targetRef={headingRef} />
        </Suspense>
      </QueryErrorBoundary>
      <CommentForm taskId={taskId} />
    </section>
  );
}
