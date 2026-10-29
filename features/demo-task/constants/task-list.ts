import type { TaskSort, TaskStatus } from "../types/task-filters";

// Record 的键必须覆盖全部取值，类型里新增状态或排序时这里会报错提醒补齐。
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "排队中",
  running: "生成中",
  done: "已完成",
  failed: "失败",
};
export const TASK_STATUSES = [
  "pending",
  "running",
  "done",
  "failed",
] as const satisfies readonly TaskStatus[];

export const TASK_SORT_LABELS: Record<TaskSort, string> = {
  created_desc: "最新创建",
  created_asc: "最早创建",
  name_asc: "名称",
};
export const TASK_SORTS = [
  "created_desc",
  "created_asc",
  "name_asc",
] as const satisfies readonly TaskSort[];

/** 全部任务页每页的条数。 */
export const TASK_LIST_PAGE_SIZE = 8;
