"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useQueries } from "@/lib/react-query";

import { getTaskQueryOptions } from "../api/get-task";
import { TASK_DETAIL_OPERATION } from "../constants/demo-faults";
import { useInjectDemoFault } from "../hooks/use-inject-demo-fault";
import { LabSection } from "./lab-section";

const TASK_IDS = ["task-10", "task-12", "task-13"];

/** 几个已有数据的 query 同时刷新失败：它们是不同的请求，各弹一个提示；同一个 query 再次失败只更新它自己的那个。 */
export function LabConcurrentFailures() {
  const t = useTranslations("demo-task");
  const injectFault = useInjectDemoFault();
  const tasks = useQueries({
    queries: TASK_IDS.map((id) => getTaskQueryOptions(id)),
  });
  return (
    <LabSection
      title={t("labConcurrentFailures.title")}
      description={t("labConcurrentFailures.description")}
    >
      <ul className="mb-4 space-y-1 text-sm">
        {tasks.map((task, index) => (
          <li key={TASK_IDS[index]}>
            {task.data?.name ?? t("queryState.loading")}
            {task.data && task.error && (
              <span className="ml-2 text-muted-foreground">
                {t("labConcurrentFailures.refreshFailed")}
              </span>
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
            operation: TASK_DETAIL_OPERATION,
            kind: "httpStatus",
            status: 409,
            times: TASK_IDS.length,
          });
          await Promise.all(tasks.map((task) => task.refetch()));
        }}
      >
        {t("labConcurrentFailures.refreshAll")}
      </Button>
    </LabSection>
  );
}
