"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@/lib/react-query";

import { getTaskQueryOptions } from "../api/get-task";
import {
  INJECTED_FAILURE_CODE,
  TASK_DETAIL_OPERATION,
} from "../constants/demo-faults";
import {
  type DemoFaultInput,
  useInjectDemoFault,
} from "../hooks/use-inject-demo-fault";
import { LabSection } from "./lab-section";

const TASK_ID = "task-07";
const detailFault = (fault: Omit<DemoFaultInput, "operation">) => ({
  operation: TASK_DETAIL_OPERATION,
  ...fault,
});

const scenarios = [
  {
    key: "serverErrorRecovers",
    fault: detailFault({ kind: "httpStatus", status: 503, times: 2 }),
  },
  // 首次请求加 3 次重试，4 次都失败才放弃。
  {
    key: "serverErrorPersists",
    fault: detailFault({ kind: "httpStatus", status: 503, times: 4 }),
  },
  {
    key: "clientError",
    fault: detailFault({ kind: "httpStatus", status: 409, times: 1 }),
  },
  {
    key: "errorBody",
    fault: detailFault({
      kind: "errorOnSuccess",
      code: INJECTED_FAILURE_CODE,
      times: 1,
    }),
  },
  { key: "malformed", fault: detailFault({ kind: "malformed", times: 1 }) },
] as const satisfies readonly { key: string; fault: DemoFaultInput }[];
type ScenarioKey = (typeof scenarios)[number]["key"];

/** `shouldRetryRequest`：5xx 和网络错误最多重试 3 次；4xx、2xx 上的 error、schema 不匹配重试也不会成功，直接失败。 */
export function LabRetry() {
  const t = useTranslations("demo-task");
  const queryClient = useQueryClient();
  const injectFault = useInjectDemoFault();
  const options = getTaskQueryOptions(TASK_ID);
  const task = useQuery(options);
  const [scenario, setScenario] = useState<ScenarioKey | null>(null);
  // 成功后 failureCount 会清零，这里在渲染时记下这一轮请求出现过的最大失败次数。
  const [failures, setFailures] = useState(0);
  if (task.failureCount > failures) setFailures(task.failureCount);

  function describeResult() {
    if (task.isFetching) {
      return task.failureCount > 0
        ? t("labRetry.retrying", { count: task.failureCount })
        : t("labRetry.requesting");
    }
    if (task.status === "success") {
      return failures > 0
        ? t("labRetry.succeededAfterRetry", { count: failures })
        : t("labRetry.succeeded");
    }
    if (task.status === "error") {
      return failures > 1
        ? t("labRetry.failedAfterRetry", { count: failures - 1 })
        : t("labRetry.failedWithoutRetry");
    }
    return null;
  }
  const result = describeResult();

  return (
    <LabSection
      title={t("labRetry.title")}
      description={t("labRetry.description")}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {scenarios.map(({ key, fault }) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!(await injectFault(fault))) return;
              setScenario(key);
              setFailures(0);
              await queryClient.resetQueries({ queryKey: options.queryKey });
            }}
          >
            {t(`labRetry.scenarios.${key}`)}
          </Button>
        ))}
      </div>
      <p className="rounded-control bg-muted p-3 text-sm" aria-live="polite">
        {scenario && result
          ? t("labRetry.scenarioResult", {
              scenario: t(`labRetry.scenarios.${scenario}`),
              result,
            })
          : result}
      </p>
    </LabSection>
  );
}
