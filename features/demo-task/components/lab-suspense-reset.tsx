"use client";

import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { useQueryClient, useSuspenseQuery } from "@/lib/react-query";

import { getTaskQueryOptions } from "../api/get-task";
import { TASK_DETAIL_ROUTE } from "../constants/mock-faults";
import { useInjectMockFault } from "../hooks/use-inject-mock-fault";
import { LabSection } from "./lab-section";
import { QueryErrorBoundary } from "./query-error-boundary";

const TASK_ID = "task-04";

/** 没有缓存数据的 `useSuspenseQuery` 失败时进入最近的错误边界；重试前要先重置 React Query 的错误边界状态。 */
export function LabSuspenseReset() {
  const queryClient = useQueryClient();
  const injectFault = useInjectMockFault();
  const [mounted, setMounted] = useState(false);
  return (
    <LabSection
      title="错误边界和重置"
      description="按钮先清掉这个任务的缓存并注入一次失败，再挂载用 useSuspenseQuery 读取它的组件。"
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
        加载（第一次会失败）
      </Button>
      {mounted && (
        <QueryErrorBoundary title="任务">
          <Suspense
            fallback={<p className="text-sm text-muted-foreground">加载中…</p>}
          >
            <SuspenseTask />
          </Suspense>
        </QueryErrorBoundary>
      )}
    </LabSection>
  );
}

function SuspenseTask() {
  const { data: task } = useSuspenseQuery(getTaskQueryOptions(TASK_ID));
  return <p className="rounded-control bg-muted p-3 text-sm">{task.name}</p>;
}
