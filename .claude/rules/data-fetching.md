---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.mjs"
  - "**/*.cjs"
  - "**/*.mts"
  - "**/*.cts"
---

# Data fetching

When choosing a data owner, integrating RSC with React Query, or changing URL/write refresh coordination, use [next-data-flow](../../.agents/skills/next-data-flow/SKILL.md). Framework mechanisms come from the installed Next.js docs; shell and prefetch optimization use the official workflows linked there. Before adding or changing a backend request, query/mutation options factory, or feature public request entry, read [data-fetching-api.md](data-fetching-api.md) for request configuration, credential setup, and factory contracts. This applies wherever the request is implemented, including Route Handlers and Server Actions. Each rule here has a runnable reference listed in the [Data demo](../../.agents/skills/next-data-flow/demos.md).

## Transport

- Requests to the app's backend, from the server and from the browser, go through `fetchApi` from `@/lib/fetch`.
- Raw `fetch` is for what `fetchApi` does not cover: third-party URLs, streaming or SSE responses, and binary downloads. Configure backend requests as [Requests](data-fetching-api.md#requests) describes.

## Copies

Render server data from its owner: props or a promise from a Server Component, or `useQuery` with `select`. Keep no copy in React state, context, or a store; the copy stops following refreshes. Refetching part of one read through a second owner, such as a query for one field of each listed item, is a copy too: it refreshes on its own schedule while everything else derived from that read, such as its filtering and counts, keeps the old state. A draft with its own editing lifecycle, such as a form being edited, may start from the data and is saved with a write.

## Errors in React Query–owned data

`app/providers.tsx` wires the global handler. A query failure shows a toast only when the query already has data: the component keeps showing that data, so the toast is the only sign that the refresh failed. A first load that fails has nothing to show, so the component renders the error instead. A mutation failure shows a generic toast, because the user acted and needs feedback.

Concurrent failures share one generic toast. Keep its ID reserved for global request errors so feature-specific feedback remains separate.

Render a query's states in this order, data first: a failed refresh keeps its data, and checking `error` first would replace data the user can still use. The error state shows the feature's own copy, chosen from `error.code` or `error.status` when it needs to vary; `ApiError.message` is written for developers and logs (`lib/fetch.ts`).

```tsx
const todos = useQuery(getTodosQueryOptions());

if (todos.data) {
  return <div>{todos.data.map(renderTodo)}</div>;
}
if (todos.error) {
  return "Couldn't load the todos.";
}

return "Loading...";
```

- Put shared defaults in the factory's [error policy](data-fetching-api.md#error-policy). For a policy specific to one caller, override `meta` there. A call site's `meta` replaces the factory's whole, so spread the factory's to change one field:

  ```tsx
  const options = getTodosQueryOptions();
  useQuery({ ...options, meta: { ...options.meta, suppressErrorToast: true } });
  ```
- Leave a mutation failure's message to the global toast; a component's `catch` or `onError` that toasts again shows a second one. Use `onError` to restore state, such as rolling back an optimistic update.
- When a component handles a recoverable failure, show its recovery UI and suppress the generic toast for that case only. Keep other failures on the global error path.
- A `useSuspenseQuery` failure reaches the nearest error boundary, such as `error.tsx`, when the query has no cached data. A failed background refetch keeps displaying cached data and follows the toast policy above. When retrying from the error boundary, call `reset()` from `useQueryErrorResetBoundary` first: until that boundary is reset, a remounted suspense query keeps its error instead of fetching again.

  ```tsx
  const { reset } = useQueryErrorResetBoundary();
  // ...
  <button onClick={() => { reset(); retry(); }}>Try again</button>
  ```

## Signing out

Signing out or switching accounts must discard the previous session's browser query data and user-specific Next.js router output, including prefetched pages and hydration snapshots. Follow [Session changes](../../.agents/skills/next-data-flow/refresh.md#session-changes) for cache coordination and verification.
