"use client";

import type { Task } from "../../api/get-task";
import { useRefreshTaskListWhenActiveChanges } from "../../hooks/use-refresh-task-list-when-active-changes";

/**
 * 列表的变化信号，只在浏览器里轮询，所以由 `TaskList` 在挂载后才渲染：服务端渲染时先创建了同一个 query 的话，
 * header 徽标的 HydrationBoundary 会把已存在的 query 留到 effect 里 hydrate，而服务端不执行 effect，徽标的数据
 * 就进不了 HTML。
 */
export function TaskListChangeSignal({ items }: { items: Task[] }) {
  useRefreshTaskListWhenActiveChanges(items);
  return null;
}
