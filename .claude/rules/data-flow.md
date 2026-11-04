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

# Data flow

When choosing a data owner, integrating RSC with React Query, or changing URL/write refresh coordination, use [next-data-flow](../../.agents/skills/next-data-flow/SKILL.md). Before adding or changing code that reads or writes data on the server (the data layer, a Server Action, a `use cache` read, or a Route Handler), read [server-data.md](server-data.md); before adding or changing a browser request or a React Query options factory, read [tanstack-query.md](tanstack-query.md). Each rule here has a runnable reference listed in the [Data demo](../../.agents/skills/next-data-flow/demos.md).

## Transport

- Server code (Server Components, `generateMetadata`, `use cache` reads, Server Actions, Route Handlers, and background jobs started from `instrumentation.ts`) calls the feature's server data layer directly ([server-data.md](server-data.md)). Route Handlers exist for the browser: a prerender at build time has no server to answer a request to them, and at request time it adds a round trip (`node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`, Caveats).
- A Server Component or `generateMetadata` that reads data that differs per request awaits `connection()` from `next/server` before calling the data layer. Without it, the read also runs while Next prerenders the route, and one request queries the database twice. A read inside `use cache` is cached across renders and skips `connection()`; calling it there is an error. The task detail page (`app/[locale]/demos/(data)/tasks/[id]/page.tsx`) is the reference.
- The browser reads through `fetchApi` from `@/lib/fetch`, against the app's Route Handlers under `/api`, and writes through Server Actions. The client dispatches Server Actions one at a time (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, Sequential dispatch on the client), so reads that poll, stream, run in parallel, or may be aborted midway stay on Route Handlers.
- Raw `fetch` is for what `fetchApi` does not cover: streaming or SSE responses, binary downloads, and URLs outside the app, such as a presigned object-storage URL. Configure requests as [Requests](tanstack-query.md#requests) describes.

## Copies

Render server data from its owner: props or a promise from a Server Component, or `useQuery` with `select`. Keep no copy in React state, context, or a store; the copy stops following refreshes. Refetching part of one read through a second owner, such as a query for one field of each listed item, is a copy too: it refreshes on its own schedule while everything else derived from that read, such as its filtering and counts, keeps the old state. A value the user edits before saving it may start from the data, such as a form being edited; a write saves it.

## Errors in React Query–owned data

### Toasts

The global handler in `app/providers.tsx` shows request failures as toasts. A query or mutation configures it through `meta` (`HandleRequestErrorOptions` from `@/lib/react-query`), set in the options factory so it holds for every caller.

- A query failure shows a toast only when the query already has data: the component keeps showing that data, so the toast is the only sign that the refresh failed. A first load that fails has nothing to show, so the component renders the error instead.
- A mutation failure shows a toast, because the user acted and needs feedback. Each write's factory takes the feature's `t` as its first argument and sets `meta.errorMessage` to that operation's message, such as "Couldn't delete the task"; a function of the error picks the message by failure. A failure without `errorMessage` shows the generic message.
- Each failing request gets its own toast: unrelated failures show side by side, and a request that fails again, such as a polling query, updates its toast instead of adding one.
- Leave the toast to the global handler; a component's `catch` or `onError` that toasts again shows a second one.
- When the feature handles a recoverable failure, show its recovery UI and suppress the toast for that case only, with a `suppressErrorToast` predicate in `meta`: `(error) => error instanceof ApiError && error.status === 404` for a `fetchApi` failure, or `(error) => isActionError(error, CODE)` from `@/lib/action-result` for a Server Action's. Keep other failures on the global path.
- A background write the user did not trigger sets `meta: { suppressErrorToast: true }`.
- For a policy specific to one caller, override `meta` at the call site. It replaces the factory's whole `meta`, so spread the factory's to change one field:

  ```tsx
  const options = getTodosQueryOptions();
  useQuery({ ...options, meta: { ...options.meta, suppressErrorToast: true } });
  ```

### Query states

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

A `useSuspenseQuery` failure reaches the nearest error boundary, such as `error.tsx`, when the query has no cached data. A failed background refetch keeps displaying cached data and follows "Toasts" above. When retrying from the error boundary, call `reset()` from `useQueryErrorResetBoundary` first: until that boundary is reset, a remounted suspense query keeps its error instead of fetching again.

```tsx
const { reset } = useQueryErrorResetBoundary();
// ...
<button onClick={() => { reset(); retry(); }}>Try again</button>
```

## Signing out

Signing out or switching accounts must discard the previous session's browser query data and user-specific Next.js router output, including prefetched pages and hydration snapshots. Follow [Session changes](../../.agents/skills/next-data-flow/refresh.md#session-changes) for cache coordination and verification.
