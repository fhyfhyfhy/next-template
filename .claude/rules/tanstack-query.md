---
paths:
  - "features/*/api/**"
---

# TanStack Query

Define the browser's requests and the React Query options factories that use them, in a feature's `api/`.

- When the code is a Server Action in `api/`, or the data layer or a `use cache` read in `server/`, read [server-data.md](server-data.md).
- When configuring how a query's or mutation's failure shows, or rendering a query's states, follow [Errors in React Query–owned data](data-flow.md#errors-in-react-queryowned-data).

## Files

- One request per file, named `<verb>-<resource>.ts` after the operation: GET → `get-` (plural for a list, `get-tasks.ts`), POST → `create-`, PUT and PATCH → `update-`, DELETE → `delete-`, and a domain verb for other actions (`cancel-task.ts`). Its response schema lives in the feature's `types/`, shared with the data layer that produces the data. Each read that React Query owns gets a `queryOptions` or `infiniteQueryOptions` factory, and every write a `mutationOptions` factory.
- Export from the feature's entry what code outside the feature uses, such as an options factory for a route's server prefetch or another feature's cache update, and keep the rest private, request functions included. Add a feature hook only for logic beyond one query or mutation, such as combining two queries.

## Requests

- `fetchApi` in `lib/fetch.ts` requests JSON over HTTP, in the browser or on the server: the app's own Route Handlers by a same-origin path such as `/api/orders`, another service's API by its full URL.
- Read `FetchApiConfig` in `lib/fetch.ts` before calling `fetchApi`. In particular, query parameters go in `params`, not in the `url` string.
- Types come from `z.infer` of the schema in `types/`, never a parallel hand-written interface. The schema describes JSON-native values only ([Results](server-data.md#results)).

## Queries

```ts
import { z } from "zod";

import { fetchApi } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

// types/task.ts
export const taskSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["pending", "running", "done", "failed"]),
  pinned: z.boolean(),
  createdAt: z.number(),
});
export type Task = z.infer<typeof taskSchema>;

// api/get-task.ts
const getTask = (id: string) =>
  fetchApi({ url: `/api/tasks/${id}`, schema: taskSchema });

export const getTaskQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["task", "detail", id],
    queryFn: () => getTask(id),
  });
```

At the call site:

```tsx
const { data: task } = useQuery(getTaskQueryOptions(id));
const { data: status } = useQuery({
  ...getTaskQueryOptions(id),
  select: (task) => task.status,
});
```

- The same factory feeds `useQuery`, `useSuspenseQuery`, `useQueries`, the cache calls that need its key, and the server prefetch ([Server prefetch and hydration](data-flow.md#server-prefetch-and-hydration)).
- A query whose inputs exist only in the browser, such as `localStorage`, waits for them: `useQuery` with `enabled`, or a `useSuspenseQuery` consumer mounted only after hydration, since it has no `enabled` and can run during server rendering.
- `queryFn` leaves React Query's `signal` out of the request by default. Add it once a query actually needs its stale requests aborted, such as search as you type:

  ```ts
  const searchTasks = (term: string, signal?: AbortSignal) =>
    fetchApi({ url: "/api/tasks/search", params: { term }, schema: taskListSchema, signal });

  export const searchTasksQueryOptions = (term: string) =>
    queryOptions({
      queryKey: [...taskListKey, "search", { term }],
      queryFn: ({ signal }) => searchTasks(term, signal),
    });
  ```
- Options for one caller, such as `select`, `enabled`, or `placeholderData`, go after the spread. `select` infers its result type, and a component that selects a slice does not re-render when other fields change.

An infinite list uses `infiniteQueryOptions` with `useInfiniteQuery` and cursor pagination (`cursorPageSchema` in `lib/fetch.ts`): the next page starts strictly after the last item loaded, so items inserted while the user scrolls cause no duplicates. Page numbers (`pageSchema` in `lib/fetch.ts`) suit lists that show a total and jump between pages.

```ts
export const getTasksInfiniteQueryOptions = (filters: TaskFilters) =>
  infiniteQueryOptions({
    queryKey: [...taskListKey, "infinite", filters],
    queryFn: ({ pageParam }) => getTaskPage({ ...filters, cursor: pageParam }),
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
```

## Query keys

Keys run from general to specific: `[feature, scope, ...params]`, with a resource segment after the feature when it holds several resources.

```
["task", "detail", id]
["task", "list", { status, sort }]
["task", "list", "infinite", { status }]
["workspace", "member", "list", workspaceId]
```

- Feature and resource names are singular. The scope is `"detail"` or `"list"`; an infinite list is a child of `"list"`, so invalidating `["task", "list"]` refreshes both list forms.
- Filters and pagination go in one object, which keeps every variant under the same prefix.
- Take a single query's key from its factory, `getTaskQueryOptions(id).queryKey`. For a prefix shared by several factories, export one constant beside them that they build on, such as `taskListKey = ["task", "list"] as const`. A key retyped as a literal at the call site drifts from the factory without any error.

## Mutations

```ts
import { mutationOptions } from "@/lib/react-query";

export const deleteTaskMutationOptions = (t: Translator) =>
  mutationOptions({
    mutationFn: deleteTaskAction,
    onSuccess: (_data, { taskId }, _onMutateResult, { client }) => {
      client.removeQueries({ queryKey: getTaskQueryOptions(taskId).queryKey });
      void client.invalidateQueries({ queryKey: taskListKey });
    },
    meta: { errorMessage: t("task.deleteTask.failed") },
  });
```

At the call site:

```tsx
const t = useTranslations();
const deleteTaskMutation = useMutation(deleteTaskMutationOptions(t));
deleteTaskMutation.mutate({ taskId }, { onSuccess: () => onClose() });
```

- A write's `mutationFn` calls its Server Action ([Server Actions](server-data.md#server-actions)). The factory lives in an ordinary module, such as `api/create-order.ts`, which imports the action. When the action returns an `ActionResult`, the factory unwraps it with `unwrapActionResult`, which throws an `ActionError` for `{ ok: false }`, all in `lib/action-result.ts`: React Query treats every resolved value as success, so without it a failed write would run `onSuccess`. Otherwise the factory passes the result on as is.
- A Client Component triggers a write through its factory, also when no query displays the data: the factory holds the pending state, the failure toast, and any cache updates.
- The factory's callbacks update the cache for every caller, reaching the `QueryClient` through the callbacks' last argument. A caller's own reaction, such as closing a dialog or navigating, stays at the call site, never in the factory. Put it in the second argument of `mutate`, whose callbacks run after the factory's and only while the component is mounted, or after `await mutateAsync(...)` when the caller needs the promise, such as a form's `onSubmit` that keeps the form submitting until the write settles.
- An optimistic update lives in the factory too. `onMutate` cancels the queries it writes, snapshots them, and writes the new value into every query that displays it, each in that query's own data shape; `onError` restores the snapshot, and the global toast reports the failure; `onSettled` invalidates them so the server's value wins. Insert into a list where its server order puts it, so the refetch does not move it.

  ```ts
  export const pinTaskMutationOptions = (t: Translator) =>
    mutationOptions({
      mutationFn: pinTaskAction,
      onMutate: async ({ taskId, pinned }, { client }) => {
        const { queryKey } = getTaskQueryOptions(taskId);
        await client.cancelQueries({ queryKey });
        const previous = client.getQueryData(queryKey);
        client.setQueryData(queryKey, (task) => task && { ...task, pinned });
        return { previous };
      },
      onError: (_error, { taskId }, onMutateResult, { client }) => {
        client.setQueryData(getTaskQueryOptions(taskId).queryKey, onMutateResult?.previous);
      },
      onSettled: (_data, _error, { taskId }, _onMutateResult, { client }) =>
        client.invalidateQueries({ queryKey: getTaskQueryOptions(taskId).queryKey }),
      meta: { errorMessage: t("task.pinTask.failed") },
    });
  ```

- Values that change per call are variables (`mutate({ taskId })`). Context fixed for the mutation, such as the record a comment belongs to, is a factory argument after `t` (`createCommentMutationOptions(t, taskId)`): it can build the request URL as well as the cache keys, and variables stay the per-call payload.
