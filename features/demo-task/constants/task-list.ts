import {
  type TaskSort,
  taskSortSchema,
  taskStatusSchema,
} from "../types/task-filters";

export const TASK_STATUSES = taskStatusSchema.options;

export const TASK_SORTS = taskSortSchema.options;

/**
 * Each sort option's key under `taskSort` in the `demo-task` messages. URL
 * values are snake_case; message keys are camelCase.
 */
export const TASK_SORT_MESSAGE_KEYS = {
  created_desc: "createdDesc",
  created_asc: "createdAsc",
  name_asc: "nameAsc",
} as const satisfies Record<TaskSort, string>;

/** Tasks per page on the All tasks page. */
export const TASK_LIST_PAGE_SIZE = 8;
