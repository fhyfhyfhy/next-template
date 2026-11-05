import { TASK_LIST_PAGE_SIZE } from "../constants/task-list";
import type { TaskListSearchParams } from "./task-list-search-params";

/** 全部任务页的 URL 状态换成列表读取的条件。URL 里小于 1 的页码按第 1 页读取。 */
export function toTaskFilters({ status, sort, page }: TaskListSearchParams) {
  return {
    status: status ? [status] : undefined,
    sort,
    page: Math.max(page, 1),
    pageSize: TASK_LIST_PAGE_SIZE,
  };
}

export function taskDetailHref(taskId: string) {
  return `/demos/tasks/${taskId}`;
}
