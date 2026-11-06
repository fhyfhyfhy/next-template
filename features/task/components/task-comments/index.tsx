"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { QueryErrorBoundary } from "../query-error-boundary";
import { CommentForm } from "./comment-form";
import { CommentList } from "./comment-list";

/** 评论只在详情页显示，由 React Query 负责；服务端以 pending 状态 dehydrate，数据到了再流式出现。 */
export function TaskComments({ taskId }: { taskId: string }) {
  const t = useTranslations();
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium">{t("task.comments.title")}</h2>
      <QueryErrorBoundary message={t("task.comments.loadFailed")}>
        <Suspense
          fallback={
            <p className="text-sm text-muted-foreground">
              {t("task.comments.loading")}
            </p>
          }
        >
          <CommentList taskId={taskId} />
        </Suspense>
      </QueryErrorBoundary>
      <CommentForm taskId={taskId} />
    </section>
  );
}
