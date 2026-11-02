"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@/lib/react-query";

import { getTaskQueryOptions } from "../api/get-task";
import { TASK_DETAIL_ROUTE } from "../constants/mock-faults";
import { useInjectMockFault } from "../hooks/use-inject-mock-fault";
import { LabSection } from "./lab-section";

const TASK_ID = "task-01";
// A 4xx isn't retried, so the result shows at once in the demo.
const FAULT = {
  method: "GET",
  path: TASK_DETAIL_ROUTE,
  status: 409,
  times: 1,
};

/**
 * A failed first load has no data to show, so the component renders the error.
 * A failed refresh keeps showing the data and leaves the news to the global
 * toast.
 */
export function LabQueryStates() {
  const t = useTranslations("demo-task");
  const queryClient = useQueryClient();
  const injectFault = useInjectMockFault();
  const options = getTaskQueryOptions(TASK_ID);
  const task = useQuery(options);

  const firstLoad = async (failing: boolean) => {
    if (failing) await injectFault(FAULT);
    // Clear the cache so the next request is a first load again.
    await queryClient.resetQueries({ queryKey: options.queryKey });
  };

  return (
    <LabSection
      title={t("labQueryStates.title")}
      description={t("labQueryStates.description")}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => firstLoad(true)}>
          {t("labQueryStates.firstLoadFails")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => firstLoad(false)}>
          {t("labQueryStates.firstLoadSucceeds")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!task.data}
          onClick={async () => {
            await injectFault(FAULT);
            await task.refetch();
          }}
        >
          {t("labQueryStates.refreshFails")}
        </Button>
      </div>
      <div className="rounded-control bg-muted p-3 text-sm">
        {task.data ? (
          <p>
            {task.data.name}
            {task.error && (
              <span className="ml-2 text-muted-foreground">
                {t("labQueryStates.refreshFailed")}
              </span>
            )}
          </p>
        ) : task.error ? (
          <p className="text-destructive">{t("queryState.loadFailed")}</p>
        ) : (
          <p className="text-muted-foreground">{t("queryState.loading")}</p>
        )}
      </div>
    </LabSection>
  );
}
