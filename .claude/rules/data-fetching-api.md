---
paths:
  - "features/*/api/**"
---

# API modules

Define the browser's requests, Server Actions, and reusable React Query options. The file conventions below apply to a feature's `api/` modules; the server data layer they reach lives in the feature's `server/` ([data-layer.md](data-layer.md)), and Next.js Route Handlers under `app/api/` follow the framework's `route.ts` convention. The `next-data-flow` skill chooses the data owner; [data-fetching.md](data-fetching.md) covers data consumers and error presentation. Read `lib/fetch.ts` and `lib/react-query.ts` for their available options and exports. `features/demo-task/api/` follows these conventions end to end; the [Data demo](../../.agents/skills/next-data-flow/demos.md) maps each one to its code.

## Files

- One request per file, named `<verb>-<resource>.ts` after the operation: GET → `get-` (plural for a list, `get-tasks.ts`), POST → `create-`, PUT and PATCH → `update-`, DELETE → `delete-`, and a domain verb for other actions (`cancel-task.ts`). Its response schema lives in the feature's `types/`, shared with the data layer that produces the data. Add a `queryOptions`, `infiniteQueryOptions`, or `mutationOptions` factory when a React Query caller needs one; a server-only read or write calls the data layer and needs no factory. Server Actions have a separate module boundary, described below.
- A server read cached with `use cache` wraps the data-layer read in its own module guarded by `import "server-only"`, one cached read per file, named `get-cached-<resource>.ts` after the function it exports, such as `api/get-cached-task-page.ts` wrapping `listTasks` from `server/tasks.ts`: `use cache` functions cannot enter a client bundle.
- Server Components, `generateMetadata`, Route Handlers, and Server Actions call the data layer directly. For consumers outside the feature, expose server readers and writers through a `server.ts` sub-entry guarded by `import "server-only"`; implementation files inside the feature use relative imports, following [Feature public API](architecture.md#feature-public-api).
- The client-facing feature entry exports the options factories that code outside the feature uses, such as a route's server prefetch or another feature's cache update; factories used only inside the feature stay private like other implementation files ([Feature public API](architecture.md#feature-public-api)). Query consumers pass them to hooks from `@/lib/react-query`; keep request functions private unless another data function or server consumer needs them. Add a feature hook only for logic beyond one query or mutation, such as combining two queries.

## Requests

- `fetchApi` runs in the browser only and requests same-origin paths such as `/api/demo/tasks`; on the server it throws, because server code calls the data layer. A raw `fetch` under the [transport exceptions](data-fetching.md#transport) also uses the same-origin path, or the full URL it was handed, such as a presigned object-storage URL.
- Query parameters go in `params` rather than into the `url` string; `FetchApiConfig` in `lib/fetch.ts` documents each option.
- Types come from `z.infer` of the schema in `types/`, never a parallel hand-written interface.
- Schemas describe JSON-native values only: timestamps as epoch milliseconds, `.nullable()` rather than `.optional()`, and no `.transform()`, `z.date()`, or `z.bigint()`. The data layer returns the same type and the Route Handler serializes it unchanged, so server-prefetched data (through RSC) and refetched data (through JSON) are identical ([data-layer.md](data-layer.md#results)).

## Error policy

Configure error policies shared by all callers in the options factory's `meta` (`HandleRequestErrorOptions` from `@/lib/react-query`). For example, use `meta: { suppressErrorToast: true }` for a background mutation the user did not trigger. [Consumer error handling](data-fetching.md#errors-in-react-queryowned-data) defines the default feedback and call-site overrides.

For a recoverable failure handled by the feature, suppress the generic toast for that case only. When a `queryFn` calls `fetchApi` in the browser, a predicate can match a failure response, such as `suppressErrorToast: (error) => error instanceof ApiError && error.status === 404`. A `mutationFn` that calls a Server Action follows [Server Action errors](../../.agents/skills/next-data-flow/react-query-integration.md#server-action-errors) to produce a locally recognizable error before applying the policy.

For server-prefetched data, apply the [hydration guidance](../../.agents/skills/next-data-flow/react-query-integration.md#hydration) before passing state to a Client Component.

## Server Actions

Every write goes through a Server Action, including writes whose data React Query owns. Keep an action imported by Client Components in its own top-level `"use server"` module, such as `api/create-task-action.ts`. It checks its inputs and calls the data layer; its runtime exports are only async Server Actions, and validation helpers used only by that action may stay private there. The data layer rejects business-rule violations with `DomainError`. An action whose caller handles some of them returns an `ActionResult` through `toActionResult` from `@/lib/action-result`, which turns those into `{ ok: false, error }`, `error` being the `ApiErrorObject` a failed Route Handler response carries; its factory unwraps the result with `unwrapActionResult`. An action without such failures returns its data, or nothing, and its factory passes it on as is. Both let other errors throw. A synchronous options factory belongs in an ordinary module, such as `api/create-task.ts`, which imports the action. When other callers need the same input schema, extract it to a sibling such as `api/create-task-request.ts`; the action must not import the factory module that calls it.

Expose actions needed outside the feature through a client-importable public sub-entry such as `actions.ts`, which re-exports the action references. Keep them separate from the `server-only` entry for direct server readers and writers. React Query callers normally consume the options factory instead. For expected errors crossing the action boundary and success-only refreshes, follow [Server Action errors](../../.agents/skills/next-data-flow/react-query-integration.md#server-action-errors).

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

- The same factory feeds `useQuery`, `useSuspenseQuery`, `useQueries`, and cache calls that need its key. A server prefetch spreads it and swaps only `queryFn` for the data layer, keeping the key and options in one place: `queryClient.query({ ...getTaskQueryOptions(id), queryFn: () => getTask(id) })` with `getTask` from the feature's `server.ts`.
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

export const deleteTaskMutationOptions = () =>
  mutationOptions({
    mutationFn: deleteTaskAction,
    onSuccess: (_data, { taskId }, _onMutateResult, { client }) => {
      client.removeQueries({ queryKey: getTaskQueryOptions(taskId).queryKey });
      void client.invalidateQueries({ queryKey: taskListKey });
    },
  });
```

At the call site:

```tsx
const deleteTaskMutation = useMutation(deleteTaskMutationOptions());
deleteTaskMutation.mutate({ taskId }, { onSuccess: () => onClose() });
```

- The factory's callbacks update the cache for every caller, reaching the `QueryClient` through the callbacks' last argument. A caller's own reaction, such as closing a dialog or navigating, stays at the call site, never in the factory. Put it in the second argument of `mutate`, whose callbacks run after the factory's and only while the component is mounted, or after `await mutateAsync(...)` when the caller needs the promise, such as a form's `onSubmit` that keeps the form submitting until the write settles.
- Values that change per call are variables (`mutate({ taskId })`). Context fixed for the mutation, such as the record a comment belongs to, is a factory argument (`createCommentMutationOptions(taskId)`): it can build the request URL as well as the cache keys, and variables stay the per-call payload.
