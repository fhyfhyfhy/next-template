import {
  createLoader,
  createSerializer,
  type inferParserType,
  parseAsInteger,
  parseAsStringLiteral,
} from "nuqs/server";

import { TASK_SORTS, TASK_STATUSES } from "../constants/task-list";

/** 全部任务页的 URL 是筛选、排序、分页的唯一来源；不认识的值按默认值处理。 */
export const taskListSearchParams = {
  status: parseAsStringLiteral(TASK_STATUSES),
  sort: parseAsStringLiteral(TASK_SORTS).withDefault("created_desc"),
  page: parseAsInteger.withDefault(1),
};

export type TaskListSearchParams = inferParserType<typeof taskListSearchParams>;

export const loadTaskListSearchParams = createLoader(taskListSearchParams);

export const serializeTaskListSearchParams =
  createSerializer(taskListSearchParams);
