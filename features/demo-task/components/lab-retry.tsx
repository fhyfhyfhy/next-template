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
  // 首次请求加 3 次重试，4 次都失败才放弃。
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

/** `shouldRetryRequest`：5xx 和网络错误最多重试 3 次；4xx、2xx 上的 error、schema 不匹配重试也不会成功，直接失败。 */
export function LabRetry() {
  const t = useTranslations("demo-task.labRetry");
  const queryClient = useQueryClient();
  const injectFault = useInjectMockFault();
  const options = getTaskQueryOptions(TASK_ID);
  const task = useQuery(options);
  const [scenario, setScenario] = useState<ScenarioKey | null>(null);
  // 成功后 failureCount 会清零，这里在渲染时记下这一轮请求出现过的最大失败次数。
  const [failures, setFailures] = useState(0);
  if (task.failureCount > failures) setFailures(task.failureCount);

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
        {scenario &&
          t("scenarioPrefix", { scenario: t(`scenarios.${scenario}`) })}
        {task.isFetching &&
          task.failureCount > 0 &&
          t("retrying", { count: task.failureCount })}
        {!task.isFetching &&
          task.status === "success" &&
          (failures > 0
            ? t("succeededAfterRetry", { count: failures })
            : t("succeeded"))}
        {!task.isFetching &&
          task.status === "error" &&
          (failures > 1
            ? t("failedAfterRetry", { count: failures - 1 })
            : t("failedWithoutRetry"))}
        {task.isFetching && task.failureCount === 0 && t("requesting")}
      </p>
    </LabSection>
  );
}
