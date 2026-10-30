"use client";

import { Button } from "@/components/ui/button";
import { useQueries } from "@/lib/react-query";

import { getTaskQueryOptions } from "../api/get-task";
import { TASK_DETAIL_ROUTE } from "../constants/mock-faults";
import { useInjectMockFault } from "../hooks/use-inject-mock-fault";
import { LabSection } from "./lab-section";

const TASK_IDS = ["task-10", "task-12", "task-13"];

/** 几个已有数据的 query 同时刷新失败，各自都会触发全局提示，但它们共用一个 toast ID，只显示一个。 */
export function LabConcurrentFailures() {
  const injectFault = useInjectMockFault();
  const tasks = useQueries({
    queries: TASK_IDS.map((id) => getTaskQueryOptions(id)),
  });
  return (
    <LabSection
      title="同时失败"
      description="按钮给详情接口注入 3 次失败，然后同时刷新下面 3 个任务。"
    >
      <ul className="mb-4 space-y-1 text-sm">
        {tasks.map((task, index) => (
          <li key={TASK_IDS[index]}>
            {task.data?.name ?? "加载中…"}
            {task.data && task.error && (
              <span className="ml-2 text-muted-foreground">（刷新失败）</span>
            )}
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        size="sm"
        disabled={tasks.some((task) => !task.data)}
        onClick={async () => {
          await injectFault({
            method: "GET",
            path: TASK_DETAIL_ROUTE,
            status: 409,
            times: TASK_IDS.length,
          });
          await Promise.all(tasks.map((task) => task.refetch()));
        }}
      >
        同时刷新（都会失败）
      </Button>
    </LabSection>
  );
}
