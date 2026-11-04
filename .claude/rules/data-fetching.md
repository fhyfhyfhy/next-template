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

When choosing a data owner, integrating RSC with React Query, or changing URL/write refresh coordination, use [next-data-flow](../../.agents/skills/next-data-flow/SKILL.md). Framework mechanisms come from the installed Next.js docs; shell and prefetch optimization use the official workflows linked there. Before adding or changing a browser request, Server Action, `use cache` read, query/mutation options factory, or feature public request entry, read [api-modules.md](api-modules.md) for request configuration and factory contracts; for the server data layer they call, read [data-layer.md](data-layer.md). Each rule here has a runnable reference listed in the [Data demo](../../.agents/skills/next-data-flow/demos.md).

## Transport

- Server code (Server Components, `generateMetadata`, `use cache` reads, Server Actions, Route Handlers, and background jobs started from `instrumentation.ts`) calls the feature's server data layer directly ([data-layer.md](data-layer.md)). Route Handlers exist for the browser: a prerender at build time has no server to answer a request to them, and at request time it adds a round trip (`node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`, Caveats).
- A Server Component or `generateMetadata` that reads uncached, per-request data awaits `connection()` from `next/server` before calling the data layer. At request time Next renders a route once more before the render it sends, and the data layer's `cache()` deduplicates only within one render, so without `connection()` the query runs twice. Reads inside `use cache` need no `connection()` and must not call it. The task detail page (`app/[locale]/demos/(data)/tasks/[id]/page.tsx`) is the reference.
- The browser reads through `fetchApi` from `@/lib/fetch`, against the app's Route Handlers under `/api`, and writes through Server Actions. The client dispatches Server Actions one at a time (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, Sequential dispatch on the client), so reads that poll, stream, run in parallel, or are aborted as the user types stay on Route Handlers.
- Raw `fetch` is for what `fetchApi` does not cover: streaming or SSE responses, binary downloads, and URLs outside the app, such as a presigned object-storage URL. Configure requests as [Requests](api-modules.md#requests) describes.

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

- Put shared defaults in the factory's [error policy](api-modules.md#error-policy). For a policy specific to one caller, override `meta` there. A call site's `meta` replaces the factory's whole, so spread the factory's to change one field:

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
