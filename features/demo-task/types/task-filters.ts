export type TaskStatus = "pending" | "running" | "done" | "failed";

export type TaskSort = "created_desc" | "created_asc" | "name_asc";

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
