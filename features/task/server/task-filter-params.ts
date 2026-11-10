import "server-only";

import { badRequest } from "@/lib/request/domain-error";
import { integerParam } from "@/lib/request/route-handler";

import {
  type TaskFilters,
  taskSortSchema,
  taskStatusSchema,
} from "../types/task-filters";

/** 任务列表接口的 query：`status` 可以重复多个，其余都是单值；不合法的值按参数错误拒绝。 */
export function parseTaskFilters(params: URLSearchParams): TaskFilters {
  const status = taskStatusSchema.array().safeParse(params.getAll("status"));
  if (!status.success) throw badRequest("Invalid status", { param: "status" });
  const sort = params.get("sort");
  const parsedSort = sort === null ? undefined : taskSortSchema.safeParse(sort);
  if (parsedSort && !parsedSort.success) {
    throw badRequest("Invalid sort", { param: "sort" });
  }
  const favorite = params.get("favorite");
  return {
    status: status.data,
    favorite: favorite === null ? undefined : favorite === "true",
    prompt: params.get("prompt") ?? undefined,
    excludeId: params.get("excludeId") ?? undefined,
    sort: parsedSort?.data,
    page: integerParam(params, "page"),
    pageSize: integerParam(params, "pageSize"),
  };
}
