import {
  type TaskSort,
  taskSortSchema,
  type TaskStatus,
  taskStatusSchema,
} from "../types/task-filters";

export const TASK_STATUSES = taskStatusSchema.options;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "排队中",
  running: "生成中",
  done: "已完成",
  failed: "失败",
};

export const TASK_SORTS = taskSortSchema.options;

export const TASK_SORT_LABELS: Record<TaskSort, string> = {
  created_desc: "最新创建",
  created_asc: "最早创建",
  name_asc: "名称",
};

/** 全部任务页每页的条数。 */
export const TASK_LIST_PAGE_SIZE = 8;
