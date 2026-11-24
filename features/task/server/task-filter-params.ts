import "server-only";
import { z } from "zod";

import { parseInput } from "@/lib/request/domain-error";
import { integerParam } from "@/lib/request/route-handler";

import {
  type TaskFilters,
  taskSortSchema,
  taskStatusSchema,
} from "../types/task-filters";

const choiceParams = z.object({
  status: taskStatusSchema.array(),
  sort: taskSortSchema.optional(),
});

/** 任务列表接口的 query：`status` 可以重复多个，其余都是单值；不合法的值按参数错误拒绝。 */
export function parseTaskFilters(params: URLSearchParams): TaskFilters {
  const { status, sort } = parseInput(choiceParams, {
    status: params.getAll("status"),
    sort: params.get("sort") ?? undefined,
  });
  const favorite = params.get("favorite");
  return {
    status,
    favorite: favorite === null ? undefined : favorite === "true",
    prompt: params.get("prompt") ?? undefined,
    excludeId: params.get("excludeId") ?? undefined,
    sort,
    page: integerParam(params, "page"),
    pageSize: integerParam(params, "pageSize"),
  };
}
