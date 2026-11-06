"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useInjectDemoFault } from "@/features/demo-faults";
import { getTaskQueryOptions } from "@/features/demo-task";
import { useQuery, useQueryClient } from "@/lib/react-query";

import { TASK_DETAIL_OPERATION } from "../constants/lab-operation";
import { LabSection } from "./lab-section";

const TASK_ID = "task-01";
// 4xx 不重试，演示时结果立即出现。
const FAULT = {
  operation: TASK_DETAIL_OPERATION,
  kind: "httpStatus",
  status: 409,
  times: 1,
} as const;

/** 首次加载失败时没有数据可显示，组件渲染错误；已有数据时刷新失败，组件继续显示数据，靠全局提示告知。 */
export function LabQueryStates() {
  const t = useTranslations("demo-lab");
  const queryClient = useQueryClient();
  const injectFault = useInjectDemoFault();
  const options = getTaskQueryOptions(TASK_ID);
  const task = useQuery(options);

  const firstLoad = async (failing: boolean) => {
    if (failing && !(await injectFault(FAULT))) return;
    // 清掉缓存，让下一次请求回到“首次加载”的状态。
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
            if (await injectFault(FAULT)) await task.refetch();
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
