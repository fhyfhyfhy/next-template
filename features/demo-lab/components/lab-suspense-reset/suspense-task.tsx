"use client";

import { getTaskQueryOptions } from "@/features/demo-task";
import { useSuspenseQuery } from "@/lib/react-query";

export function SuspenseTask({ taskId }: { taskId: string }) {
  const { data: task } = useSuspenseQuery(getTaskQueryOptions(taskId));
  return <p className="rounded-control bg-muted p-3 text-sm">{task.name}</p>;
}
