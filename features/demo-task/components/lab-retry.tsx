"use client";

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

const scenarios: { label: string; fault: MockFaultInput }[] = [
  { label: "5xx 两次后恢复", fault: detailFault({ status: 503, times: 2 }) },
  // 首次请求加 3 次重试，4 次都失败才放弃。
  { label: "5xx 一直失败", fault: detailFault({ status: 503, times: 4 }) },
  { label: "4xx", fault: detailFault({ status: 409, times: 1 }) },
  {
    label: "业务 code",
    fault: detailFault({ code: INJECTED_FAILURE_CODE, times: 1 }),
  },
  { label: "schema 不匹配", fault: detailFault({ malformed: true, times: 1 }) },
];

/** `shouldRetryRequest`：5xx 和网络错误最多重试 3 次；4xx、2xx 上的业务 code、schema 不匹配重试也不会成功，直接失败。 */
export function LabRetry() {
  const queryClient = useQueryClient();
  const injectFault = useInjectMockFault();
  const options = getTaskQueryOptions(TASK_ID);
  const task = useQuery(options);
  const [scenario, setScenario] = useState<string | null>(null);
  // 成功后 failureCount 会清零，这里在渲染时记下这一轮请求出现过的最大失败次数。
  const [failures, setFailures] = useState(0);
  if (task.failureCount > failures) setFailures(task.failureCount);

  return (
    <LabSection
      title="重试规则"
      description="每个按钮先给详情接口注入故障，再重新请求。schema 不匹配说明前后端契约已经不一致，全局处理会在控制台留下 SchemaValidationError。"
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {scenarios.map(({ label, fault }) => (
          <Button
            key={label}
            variant="outline"
            size="sm"
            onClick={async () => {
              await injectFault(fault);
              setScenario(label);
              setFailures(0);
              await queryClient.resetQueries({ queryKey: options.queryKey });
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="rounded-control bg-muted p-3 text-sm" aria-live="polite">
        {scenario && `${scenario}：`}
        {task.isFetching &&
          task.failureCount > 0 &&
          `第 ${task.failureCount} 次失败，正在重试…`}
        {!task.isFetching &&
          task.status === "success" &&
          (failures > 0 ? `成功，失败 ${failures} 次后重试成功` : "成功")}
        {!task.isFetching &&
          task.status === "error" &&
          (failures > 1 ? `失败，重试了 ${failures - 1} 次` : "失败，没有重试")}
        {task.isFetching && task.failureCount === 0 && "请求中…"}
      </p>
    </LabSection>
  );
}
