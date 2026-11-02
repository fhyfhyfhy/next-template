import {
  TASK_LIST_PAGE_SIZE,
  TASK_SORTS,
  TASK_STATUSES,
} from "../constants/task-list";
import type { TaskSort, TaskStatus } from "../types/task-filters";

export interface TaskListParams {
  status: TaskStatus | undefined;
  sort: TaskSort;
  page: number;
}

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The All tasks page's URL is the only source of its filter, sort and page;
 * unknown values fall back to the defaults.
 */
export function parseTaskListParams(
  searchParams: SearchParams,
): TaskListParams {
  const status = first(searchParams.status);
  const sort = first(searchParams.sort);
  const page = Number.parseInt(first(searchParams.page) ?? "", 10);
  return {
    status: TASK_STATUSES.find((value) => value === status),
    sort: TASK_SORTS.find((value) => value === sort) ?? "created_desc",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function toTaskFilters({ status, sort, page }: TaskListParams) {
  return {
    status: status ? [status] : undefined,
    sort,
    page,
    pageSize: TASK_LIST_PAGE_SIZE,
  };
}

/**
 * Builds a link to the All tasks page, leaving defaults out of the URL. When
 * the filter or sort changes, the caller resets `page` to 1.
 */
export function taskListHref({ status, sort, page }: TaskListParams) {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (sort !== "created_desc") query.set("sort", sort);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search ? `/demos/tasks?${search}` : "/demos/tasks";
}

export function taskDetailHref(taskId: string) {
  return `/demos/tasks/${taskId}`;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
