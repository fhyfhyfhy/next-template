---
paths:
  - "features/*/api/**"
---

# TanStack Query

Define the browser's requests and the React Query options factories that use them, in a feature's `api/`. Server Actions in `api/`, and the data layer and `use cache` reads in `server/`, follow [server-data.md](server-data.md). A factory's `meta` configures the failure toasts, as [Toasts](data-flow.md#toasts) describes. The `next-data-flow` skill chooses the data owner. Read `lib/fetch.ts` and `lib/react-query.ts` for their available options and exports. `features/demo-task/api/` follows these conventions end to end; the [Data demo](../../.agents/skills/next-data-flow/demos.md) maps each one to its code.

## Files

- One request per file, named `<verb>-<resource>.ts` after the operation: GET → `get-` (plural for a list, `get-tasks.ts`), POST → `create-`, PUT and PATCH → `update-`, DELETE → `delete-`, and a domain verb for other actions (`cancel-task.ts`). Its response schema lives in the feature's `types/`, shared with the data layer that produces the data. Add a `queryOptions`, `infiniteQueryOptions`, or `mutationOptions` factory when a React Query caller needs one; a server-only read or write calls the data layer and needs no factory.
- The client-facing feature entry exports the options factories that code outside the feature uses, such as a route's server prefetch or another feature's cache update; factories used only inside the feature stay private. Query consumers pass them to hooks from `@/lib/react-query`; keep request functions private unless another data function or server consumer needs them. Add a feature hook only for logic beyond one query or mutation, such as combining two queries.

## Requests

- `fetchApi` runs in the browser only and requests same-origin paths such as `/api/demo/tasks`; on the server it throws, because server code calls the data layer. A raw `fetch` under the [transport exceptions](data-flow.md#transport) also uses the same-origin path, or the full URL it was handed, such as a presigned object-storage URL.
- Query parameters go in `params` rather than into the `url` string; `FetchApiConfig` in `lib/fetch.ts` documents each option.
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

- The same factory feeds `useQuery`, `useSuspenseQuery`, `useQueries`, and cache calls that need its key. A server prefetch spreads it and swaps only `queryFn` for the data layer, keeping the key and options in one place: `queryClient.query({ ...getCommentsQueryOptions(id), queryFn: () => listComments(id) })` with `listComments` from the feature's `server.ts`. Apply the [hydration guidance](../../.agents/skills/next-data-flow/react-query-integration.md#hydration) before passing the prefetched state to a Client Component.
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

An infinite list uses `infiniteQueryOptions` with `useInfiniteQuery` and cursor pagination (`cursorPageSchema` in `lib/fetch.ts`): the next page starts strictly after the last item loaded, so items inserted while the user scrolls cause no duplicates. Page numbers (`pageSchema`) suit lists that show a total and jump between pages.

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

export const deleteTaskMutationOptions = (t: TaskTranslator) =>
  mutationOptions({
    mutationFn: deleteTaskAction,
    onSuccess: (_data, { taskId }, _onMutateResult, { client }) => {
      client.removeQueries({ queryKey: getTaskQueryOptions(taskId).queryKey });
      void client.invalidateQueries({ queryKey: taskListKey });
    },
    meta: { errorMessage: t("deleteTask.failed") },
  });
```

At the call site:

```tsx
const t = useTranslations("task");
const deleteTaskMutation = useMutation(deleteTaskMutationOptions(t));
deleteTaskMutation.mutate({ taskId }, { onSuccess: () => onClose() });
```

- A write's `mutationFn` calls its Server Action ([Server Actions](server-data.md#server-actions)). The factory lives in an ordinary module, such as `api/create-task.ts`, which imports the action. When the action returns an `ActionResult`, the factory unwraps it with `unwrapActionResult` from `@/lib/action-result`; otherwise it passes the result on as is. Code outside the feature normally uses the factory rather than the action. For expected errors crossing the action boundary and success-only refreshes, follow [Server Action errors](../../.agents/skills/next-data-flow/react-query-integration.md#server-action-errors).
- The factory's callbacks update the cache for every caller, reaching the `QueryClient` through the callbacks' last argument. A caller's own reaction, such as closing a dialog or navigating, stays at the call site, never in the factory. Put it in the second argument of `mutate`, whose callbacks run after the factory's and only while the component is mounted, or after `await mutateAsync(...)` when the caller needs the promise, such as a form's `onSubmit` that keeps the form submitting until the write settles.
- Values that change per call are variables (`mutate({ taskId })`). Context fixed for the mutation, such as the record a comment belongs to, is a factory argument after `t` (`createCommentMutationOptions(t, taskId)`): it can build the request URL as well as the cache keys, and variables stay the per-call payload.
