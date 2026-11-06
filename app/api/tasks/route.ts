import { listTasks, parseTaskFilters } from "@/features/task/server";
import { routeHandler } from "@/lib/route-handler";

/** 任务列表：query 为 `status`（可重复）、`favorite`、`prompt`、`excludeId`、`sort`、`page`、`pageSize`。 */
export const GET = routeHandler(async (request) =>
  listTasks(parseTaskFilters(new URL(request.url).searchParams)),
);
