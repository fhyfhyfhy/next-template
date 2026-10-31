import {
  type TaskSort,
  taskSortSchema,
  taskStatusSchema,
} from "../types/task-filters";

export const TASK_STATUSES = taskStatusSchema.options;

export const TASK_SORTS = taskSortSchema.options;

/** 排序选项在 `demo-task` 文案 `taskSort` 下的 key；URL 里的取值是 snake_case，文案 key 是 camelCase。 */
export const TASK_SORT_MESSAGE_KEYS = {
  created_desc: "createdDesc",
  created_asc: "createdAsc",
  name_asc: "nameAsc",
} as const satisfies Record<TaskSort, string>;

/** 全部任务页每页的条数。 */
export const TASK_LIST_PAGE_SIZE = 8;
