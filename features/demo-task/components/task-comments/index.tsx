"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { QueryErrorBoundary } from "../query-error-boundary";
import { CommentForm } from "./comment-form";
import { CommentList } from "./comment-list";

/**
 * Comments show only on the detail page, and React Query owns them. The server
 * dehydrates them as pending, and they stream in when the data arrives.
 */
export function TaskComments({ taskId }: { taskId: string }) {
  const t = useTranslations("demo-task.comments");
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium">{t("title")}</h2>
      <QueryErrorBoundary message={t("loadFailed")}>
        <Suspense
          fallback={
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          }
        >
          <CommentList taskId={taskId} />
        </Suspense>
      </QueryErrorBoundary>
      <CommentForm taskId={taskId} />
    </section>
  );
}
