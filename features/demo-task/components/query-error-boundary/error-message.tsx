"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useQueryErrorResetBoundary } from "@/lib/react-query";

export interface QueryErrorBoundaryProps {
  /** The message shown on error, such as "Couldn't load comments". */
  message: string;
}

interface ErrorMessageProps extends QueryErrorBoundaryProps {
  retry: () => void;
}

export function ErrorMessage({ message, retry }: ErrorMessageProps) {
  const t = useTranslations("demo-task.queryErrorBoundary");
  const { reset } = useQueryErrorResetBoundary();
  return (
    <div
      role="alert"
      className="rounded-panel border border-destructive/40 p-4 text-sm"
    >
      <p>{message}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => {
          // Reset React Query's error boundary state first; otherwise the
          // remounted suspense query keeps its last error.
          reset();
          retry();
        }}
      >
        {t("retry")}
      </Button>
    </div>
  );
}
