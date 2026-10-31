import { z } from "zod";

// 状态和排序的 schema 放在 types：请求的 schema（api）和 URL 解析（utils）都要用，utils 不能引用 api。
export const taskStatusSchema = z.enum([
  "pending",
  "running",
  "done",
  "failed",
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskSortSchema = z.enum([
  "created_desc",
  "created_asc",
  "name_asc",
]);
export type TaskSort = z.infer<typeof taskSortSchema>;

/** 任务列表接口的过滤和分页条件，URL 解析（utils）和请求函数（api）共用。 */
export interface TaskFilters {
  status?: TaskStatus[];
  favorite?: boolean;
  prompt?: string;
  excludeId?: string;
  sort?: TaskSort;
  page?: number;
  pageSize?: number;
}
