"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useQueries } from "@/lib/react-query";

import { getTaskQueryOptions } from "../api/get-task";
import { TASK_DETAIL_ROUTE } from "../constants/mock-faults";
import { useInjectMockFault } from "../hooks/use-inject-mock-fault";
import { LabSection } from "./lab-section";

const TASK_IDS = ["task-10", "task-12", "task-13"];

/** 几个已有数据的 query 同时刷新失败，各自都会触发全局提示，但它们共用一个 toast ID，只显示一个。 */
export function LabConcurrentFailures() {
  const t = useTranslations("demo-task");
  const injectFault = useInjectMockFault();
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
            method: "GET",
            path: TASK_DETAIL_ROUTE,
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
