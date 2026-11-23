"use client";

import { useTranslations } from "next-intl";
import { Suspense, useRef } from "react";

import { QueryErrorBoundary } from "../query-error-boundary";
import { CommentForm } from "./comment-form";
import { CommentList } from "./comment-list";
import { FocusAfterRetry } from "./focus-after-retry";

/** 评论只在详情页显示，由 React Query 负责；服务端以 pending 状态 dehydrate，数据到了再流式出现。 */
export function TaskComments({ taskId }: { taskId: string }) {
  const t = useTranslations();
  const headingRef = useRef<HTMLHeadingElement>(null);
  // 重试时 Suspense 的 fallback 换掉了刚按的重试按钮，焦点掉到 body；评论显示出来后把焦点移到标题，键盘用户从这里继续。
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
        onRetry={() => {
          retriedRef.current = true;
        }}
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
