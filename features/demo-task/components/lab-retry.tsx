"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@/lib/react-query";

import { getTaskQueryOptions } from "../api/get-task";
import {
  INJECTED_FAILURE_CODE,
  TASK_DETAIL_ROUTE,
} from "../constants/mock-faults";
import {
  type MockFaultInput,
  useInjectMockFault,
} from "../hooks/use-inject-mock-fault";
import { LabSection } from "./lab-section";

const TASK_ID = "task-07";
const detailFault = (fault: Omit<MockFaultInput, "method" | "path">) => ({
  method: "GET",
  path: TASK_DETAIL_ROUTE,
  ...fault,
});

const scenarios = [
  {
    key: "serverErrorRecovers",
    fault: detailFault({ status: 503, times: 2 }),
  },
  // The first request plus 3 retries; it gives up only after all 4 fail.
  {
    key: "serverErrorPersists",
    fault: detailFault({ status: 503, times: 4 }),
  },
  { key: "clientError", fault: detailFault({ status: 409, times: 1 }) },
  {
    key: "errorBody",
    fault: detailFault({ code: INJECTED_FAILURE_CODE, times: 1 }),
  },
  { key: "malformed", fault: detailFault({ malformed: true, times: 1 }) },
] as const satisfies readonly { key: string; fault: MockFaultInput }[];
type ScenarioKey = (typeof scenarios)[number]["key"];

/**
 * `shouldRetryRequest`: 5xx and network errors are retried up to 3 times. A
 * 4xx, an error on a 2xx or a schema mismatch wouldn't succeed on retry, so
 * they fail at once.
 */
export function LabRetry() {
  const t = useTranslations("demo-task.labRetry");
  const queryClient = useQueryClient();
  const injectFault = useInjectMockFault();
  const options = getTaskQueryOptions(TASK_ID);
  const task = useQuery(options);
  const [scenario, setScenario] = useState<ScenarioKey | null>(null);
  // failureCount resets on success, so record during render the highest failure
  // count this round of requests has reached.
  const [failures, setFailures] = useState(0);
  if (task.failureCount > failures) setFailures(task.failureCount);

  function describeResult() {
    if (task.isFetching) {
      return task.failureCount > 0
        ? t("retrying", { count: task.failureCount })
        : t("requesting");
    }
    if (task.status === "success") {
      return failures > 0
        ? t("succeededAfterRetry", { count: failures })
        : t("succeeded");
    }
    if (task.status === "error") {
      return failures > 1
        ? t("failedAfterRetry", { count: failures - 1 })
        : t("failedWithoutRetry");
    }
    return null;
  }
  const result = describeResult();

  return (
    <LabSection title={t("title")} description={t("description")}>
      <div className="mb-4 flex flex-wrap gap-2">
        {scenarios.map(({ key, fault }) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            onClick={async () => {
              await injectFault(fault);
              setScenario(key);
              setFailures(0);
              await queryClient.resetQueries({ queryKey: options.queryKey });
            }}
          >
            {t(`scenarios.${key}`)}
          </Button>
        ))}
      </div>
      <p className="rounded-control bg-muted p-3 text-sm" aria-live="polite">
        {scenario && result
          ? t("scenarioResult", {
              scenario: t(`scenarios.${scenario}`),
              result,
            })
          : result}
      </p>
    </LabSection>
  );
}
