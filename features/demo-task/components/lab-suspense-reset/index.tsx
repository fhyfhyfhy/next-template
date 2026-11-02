"use client";

import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { useQueryClient } from "@/lib/react-query";

import { getTaskQueryOptions } from "../../api/get-task";
import { TASK_DETAIL_OPERATION } from "../../constants/demo-faults";
import { useInjectDemoFault } from "../../hooks/use-inject-demo-fault";
import { LabSection } from "../lab-section";
import { QueryErrorBoundary } from "../query-error-boundary";
import { SuspenseTask } from "./suspense-task";

const TASK_ID = "task-04";

/** 没有缓存数据的 `useSuspenseQuery` 失败时进入最近的错误边界；重试前要先重置 React Query 的错误边界状态。 */
export function LabSuspenseReset() {
  const t = useTranslations("demo-task");
  const queryClient = useQueryClient();
  const injectFault = useInjectDemoFault();
  const [mounted, setMounted] = useState(false);
  return (
    <LabSection
      title={t("labSuspenseReset.title")}
      description={t("labSuspenseReset.description")}
    >
      <Button
        variant="outline"
        size="sm"
        className="mb-4"
        onClick={async () => {
          setMounted(false);
          queryClient.removeQueries({
            queryKey: getTaskQueryOptions(TASK_ID).queryKey,
          });
          await injectFault({
            operation: TASK_DETAIL_OPERATION,
            kind: "httpStatus",
            status: 409,
            times: 1,
          });
          setMounted(true);
        }}
      >
        {t("labSuspenseReset.load")}
      </Button>
      {mounted && (
        <QueryErrorBoundary message={t("labSuspenseReset.loadFailed")}>
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">
                {t("queryState.loading")}
              </p>
            }
          >
            <SuspenseTask taskId={TASK_ID} />
          </Suspense>
        </QueryErrorBoundary>
      )}
    </LabSection>
  );
}
