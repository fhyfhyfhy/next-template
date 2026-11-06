import { demoRoute } from "@/features/demo-faults/server";
import { listTasks, parseTaskFilters } from "@/features/demo-task/server";

/** 任务列表：query 为 `status`（可重复）、`favorite`、`prompt`、`excludeId`、`sort`、`page`、`pageSize`。 */
export const GET = demoRoute(async (request) =>
  listTasks(parseTaskFilters(new URL(request.url).searchParams)),
);
