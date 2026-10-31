"use client";

import { useSuspenseQuery } from "@/lib/react-query";

import { getTaskQueryOptions } from "../../api/get-task";

export function SuspenseTask({ taskId }: { taskId: string }) {
  const { data: task } = useSuspenseQuery(getTaskQueryOptions(taskId));
  return <p className="rounded-control bg-muted p-3 text-sm">{task.name}</p>;
}
