"use client";

import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { useQueryClient } from "@/lib/react-query";

import { getTaskQueryOptions } from "../../api/get-task";
import { TASK_DETAIL_ROUTE } from "../../constants/mock-faults";
import { useInjectMockFault } from "../../hooks/use-inject-mock-fault";
import { LabSection } from "../lab-section";
import { QueryErrorBoundary } from "../query-error-boundary";
import { SuspenseTask } from "./suspense-task";

const TASK_ID = "task-04";

/**
 * A failing `useSuspenseQuery` with no cached data goes to the nearest error
 * boundary; reset React Query's error boundary state before retrying.
 */
export function LabSuspenseReset() {
  const t = useTranslations("demo-task");
  const queryClient = useQueryClient();
  const injectFault = useInjectMockFault();
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
            method: "GET",
            path: TASK_DETAIL_ROUTE,
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
