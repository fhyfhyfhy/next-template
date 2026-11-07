import type { InfiniteData, QueryClient, QueryKey } from "@/lib/react-query";

import type { FeedPage, Task, TaskPage } from "../types/task";

/** 任务列表在缓存里的三种形态：页码分页的列表、作品广场的无限列表和搜索结果。 */
export type CachedTaskList = TaskPage | InfiniteData<FeedPage> | Task[];

export type TaskListSnapshot = [QueryKey, CachedTaskList | undefined][];

/** 和列表接口默认的 `created_desc` 一致（server/tasks.ts 的 `listTasks`），按它插入的位置就是重新请求后的位置。 */
function newestFirst(a: Task, b: Task) {
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/**
 * 取消 `listKey` 下进行中的列表请求，免得它带着旧数据覆盖乐观更新，再记下每份列表，失败时交给 `restoreTaskLists`。
 * 下面几个函数的 `listKey` 都是任务列表 query key 的共同前缀。
 */
export async function snapshotTaskLists(
  client: QueryClient,
  listKey: QueryKey,
): Promise<TaskListSnapshot> {
  await client.cancelQueries({ queryKey: listKey });
  return client.getQueriesData<CachedTaskList>({ queryKey: listKey });
}

export function restoreTaskLists(
  client: QueryClient,
  snapshot: TaskListSnapshot | undefined,
) {
  for (const [queryKey, data] of snapshot ?? []) {
    client.setQueryData(queryKey, data);
  }
}

/** 改写每份缓存列表里的这个任务。`update` 只写变化的字段，其余字段保留各列表缓存里的值。 */
export function setTaskInLists(
  client: QueryClient,
  listKey: QueryKey,
  taskId: string,
  update: (task: Task) => Task,
) {
  updateLists(client, listKey, (items) =>
    items.map((item) => (item.id === taskId ? update(item) : item)),
  );
}

/** 从每份缓存列表里去掉这个任务，页码分页的列表同时把 `total` 减一。 */
export function removeTaskFromLists(
  client: QueryClient,
  listKey: QueryKey,
  taskId: string,
) {
  updateLists(
    client,
    listKey,
    (items) => items.filter((item) => item.id !== taskId),
    (page) => removeTaskFromPage(page, taskId),
  );
}

/**
 * 按创建时间从新到旧（`newestFirst`）把任务插进一页列表，`total` 加一，挤出页尾的任务。排在这一页之前或之后的
 * 任务属于别的页，只计入 `total`。列表里已有这个任务时先去掉旧的，`total` 不变。
 */
export function insertTaskIntoPage(page: TaskPage, task: Task): TaskPage {
  const rest = page.items.filter((item) => item.id !== task.id);
  const total = page.total - (page.items.length - rest.length) + 1;
  const index = rest.findIndex((item) => newestFirst(task, item) < 0);
  const at = index === -1 ? rest.length : index;
  const belongsHere = (at > 0 || page.page === 1) && at < page.pageSize;
  const items = belongsHere
    ? [...rest.slice(0, at), task, ...rest.slice(at)].slice(0, page.pageSize)
    : rest;
  return { ...page, items, total, hasMore: page.page * page.pageSize < total };
}

/** 从一页列表里去掉任务，`total` 减一；这一页没有它时原样返回。 */
export function removeTaskFromPage(page: TaskPage, taskId: string): TaskPage {
  const items = page.items.filter((item) => item.id !== taskId);
  if (items.length === page.items.length) return page;
  const total = page.total - 1;
  return { ...page, items, total, hasMore: page.page * page.pageSize < total };
}

/** 按形态改写每份缓存列表：`updateItems` 改任务数组，`updatePage` 另外处理页码分页列表的 `total` 等字段。 */
function updateLists(
  client: QueryClient,
  listKey: QueryKey,
  updateItems: (items: Task[]) => Task[],
  updatePage: (page: TaskPage) => TaskPage = (page) => ({
    ...page,
    items: updateItems(page.items),
  }),
) {
  client.setQueriesData<CachedTaskList>({ queryKey: listKey }, (data) => {
    if (!data) return data;
    if (Array.isArray(data)) return updateItems(data);
    if ("pages" in data) {
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: updateItems(page.items),
        })),
      };
    }
    return updatePage(data);
  });
}
