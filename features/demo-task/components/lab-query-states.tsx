"use client";

import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@/lib/react-query";

import { getTaskQueryOptions } from "../api/get-task";
import { TASK_DETAIL_ROUTE } from "../constants/mock-faults";
import { useInjectMockFault } from "../hooks/use-inject-mock-fault";
import { LabSection } from "./lab-section";

const TASK_ID = "task-01";
// 4xx 不重试，演示时结果立即出现。
const FAULT = {
  method: "GET",
  path: TASK_DETAIL_ROUTE,
  status: 409,
  times: 1,
};

/** 首次加载失败时没有数据可显示，组件渲染错误；已有数据时刷新失败，组件继续显示数据，靠全局提示告知。 */
export function LabQueryStates() {
  const queryClient = useQueryClient();
  const injectFault = useInjectMockFault();
  const options = getTaskQueryOptions(TASK_ID);
  const task = useQuery(options);

  const firstLoad = async (failing: boolean) => {
    if (failing) await injectFault(FAULT);
    // 清掉缓存，让下一次请求回到“首次加载”的状态。
    await queryClient.resetQueries({ queryKey: options.queryKey });
  };

  return (
    <LabSection
      title="首次加载和刷新失败"
      description="渲染顺序是先看 data，再看 error，最后才是 loading：刷新失败时 error 和旧数据同时存在，先看 error 会把还能用的数据换掉。"
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => firstLoad(true)}>
          首次加载（会失败）
        </Button>
        <Button variant="outline" size="sm" onClick={() => firstLoad(false)}>
          首次加载（会成功）
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
          刷新（会失败）
        </Button>
      </div>
      <div className="rounded-control bg-muted p-3 text-sm">
        {task.data ? (
          <p>
            {task.data.name}
            {task.error && (
              <span className="ml-2 text-muted-foreground">
                （刷新失败，仍显示旧数据）
              </span>
            )}
          </p>
        ) : task.error ? (
          <p className="text-destructive">加载失败：{task.error.message}</p>
        ) : (
          <p className="text-muted-foreground">加载中…</p>
        )}
      </div>
    </LabSection>
  );
}
