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

- When writing or changing code that displays backend data, or a write that changes data a page displays, use [next-data-flow](../../.agents/skills/next-data-flow/SKILL.md).
- When adding or changing code that reads or writes data on the server (the data layer, a Server Action, a `use cache` read, or a Route Handler), read [server-data.md](server-data.md).
- When adding or changing a browser request or a React Query options factory, read [tanstack-query.md](tanstack-query.md).

## Transport

- Server code (Server Components, `generateMetadata`, `use cache` reads, Server Actions, Route Handlers, and background jobs started from `instrumentation.ts`) calls the feature's server data layer directly. Route Handlers exist for the browser: a prerender at build time has no server to answer a request to them, and at request time it adds a round trip (`node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`, Caveats).
- A Server Component or `generateMetadata` that reads data that differs per request awaits `connection()` from `next/server` before calling the data layer. Without it, the read also runs while Next prerenders the route, and one request queries the database twice. A read inside `use cache` is cached across renders and skips `connection()`; calling it there is an error.
- The browser reads through `fetchApi` in `lib/fetch.ts`, against the app's Route Handlers under `/api`, and writes through Server Actions. The client dispatches Server Actions one at a time (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, Sequential dispatch on the client), so reads that poll, stream, run in parallel, or may be aborted midway stay on Route Handlers.
- Raw `fetch` is for what `fetchApi` does not cover: streaming or SSE responses and binary bodies, such as a file sent to a presigned object-storage URL or a model file downloaded.

## URL state

A page's state that belongs in the URL, such as its filters, sorting, pagination, or search term, goes through nuqs. [URL changes](../../.agents/skills/next-data-flow/refresh.md#url-changes) decides which updates navigate, push history, or wait for a pause; this section turns them into code.

- Define a page's parsers once, in the owning feature's `utils/<page>-search-params.ts`, such as `order-list-search-params.ts`, and export from the same module a loader (`createLoader`) and a serializer (`createSerializer`) built on them. Import these from `nuqs/server`: the `nuqs` entry is a client module, and Server Components use them too.
- A Server Component reads the state with the loader, inside the `<Suspense>` that awaits `searchParams`. A Client Component reads and sets it with `useQueryStates` from `nuqs` and the same parsers, rendered inside `<Suspense>`, since the hook reads `useSearchParams`. A link to another state of the page takes its `href` from the serializer.
- Express the decisions through the setter's options:

  | Decision | Option |
  | --- | --- |
  | A Server Component reads the state | `shallow: false`, with `startTransition` from `useTransition` to mark the previous content `aria-busy` while the server responds |
  | Only query-owned reads depend on it | `shallow: true`, the default |
  | Back should undo the change | `history: "push"`; intermediate states keep the default `"replace"` |
  | The input changes continuously | With `shallow: false`, `limitUrlUpdates: debounce(ms)`: the value updates at once, the server render after the pause. For query-owned reads, build the query key from the value debounced with `useDebouncedValue` from `@mantine/hooks`: `limitUrlUpdates` leaves the hook's value immediate |

- When the content to mark busy sits in another component than the setter's caller, hold `useTransition` in a Client Component that wraps both and share it through context: the caller passes `startTransition` to the setter, and a Client Component around the content sets `aria-busy` from `isPending`.
- The new value shows at once, also while a `shallow: false` update waits for the server: nuqs holds it in `useOptimistic` until the navigation commits. A `Link` to another state of the page gets the same by calling the setter in `onNavigate` after `event.preventDefault()`; `onNavigate` skips modifier clicks, which still open a new tab.

## Server prefetch and hydration

When a Server Component prefetches a read that React Query owns, follow the installed guide `node_modules/next/dist/docs/01-app/02-guides/client-side-data-fetching/tanstack-query.md`, adapted as below.

- Create a `QueryClient` in `lib/react-query.ts` per render on the server; the browser reuses the one in `app/providers.tsx`.
- Prefetch with the feature's options factory, swapping only `queryFn` for the data layer, which returns the data that key holds: `queryClient.query({ ...getCommentsQueryOptions(id), queryFn: () => listComments(id) })`. `query()` replaces the guide's deprecated `prefetchQuery`: add `.catch(noop)` (`noop` in `lib/react-query.ts`) to ignore a failure as `prefetchQuery` did, and leave it unawaited to stream a pending query.
- Pick the guide's pattern per hydration site: **Provide initial data from a Server Component** for prefetch and pending streaming, or **Build a prerenderable hydration state** for cached data. Read a prerenderable state's timestamp in the same `use cache` function as its data, which returns both, such as `{ page, fetchedAt }`: the two then expire and refresh together, and hydration relies on that timestamp to tell whether the data is newer than the browser's.
- Behind the guide's Suspense boundary, a prerenderable state reaches the HTML while its UI renders only in the browser. To render that UI on the server too, give the consuming query `staleTime: "static"` while `environmentManager.isServer()`, keeping the browser's `staleTime`.
- A prerenderable infinite query carries only its first page: pass it to `HydrationBoundary` only for queries the browser has no data for, keeping the state's queries whose `queryClient.getQueryCache().get(queryHash)` has no `data`, so it never replaces pages already loaded.
- Function values in `meta`, such as a `suppressErrorToast` predicate, cannot cross to a Client Component: omit them from the `meta` of each dehydrated query and mutation at the hydration site, copying the entries rather than changing the factory's options.

## Copies

Render server data from its owner: props or a promise from a Server Component, or `useQuery` with `select`. Keep no copy in React state, context, or a store; the copy stops following refreshes. Refetching part of one read through a second owner, such as a query for one field of each listed item, is a copy too: it refreshes on its own schedule while everything else derived from that read, such as its filtering and counts, keeps the old state. A Server Component that prefetches a query for React Query and renders from the same result, such as a count beside the list, makes a copy too: the count keeps the prefetched value while the list follows each refetch. A value the user edits before saving it may start from the data, such as a form being edited; a write saves it.

## Optimistic updates

[Optimistic updates](../../.agents/skills/next-data-flow/refresh.md#optimistic-updates) decides when a write shows its result before the server confirms it. Write the optimistic value through the displayed value's owner:

- A value React Query owns: the factory's `onMutate` ([Mutations](tanstack-query.md#mutations)).
- A value a Server Component renders: `useOptimistic` in the Client Component that triggers the write, set inside the transition that awaits the write. The value falls back to the server's when the transition ends, so it needs no rollback. Catch the write's rejection in the transition: an uncaught one reaches the nearest error boundary.

  ```tsx
  const [pinned, setPinned] = useOptimistic(task.pinned);
  const pinTaskMutation = useMutation(pinTaskMutationOptions(t));

  function togglePinned() {
    const next = !pinned;
    startTransition(async () => {
      setPinned(next);
      try {
        await pinTaskMutation.mutateAsync({ taskId: task.id, pinned: next });
      } catch {
        // The factory's meta.errorMessage already shows the failure toast.
      }
    });
  }
  ```

  When React Query also displays the value, such as in a detail query or a list cached for another page, the factory's `onMutate` updates it there as well ([Mutations](tanstack-query.md#mutations)).

## Errors in React Query–owned data

### Toasts

The global handler in `app/providers.tsx` shows request failures as toasts. A query or mutation configures it through `meta` (`HandleRequestErrorOptions` in `lib/react-query.ts`), set in the options factory so it holds for every caller.

- A query failure shows a toast only when the query already has data: the component keeps showing that data, so the toast is the only sign that the refresh failed. A first load that fails has nothing to show, so the component renders the error instead.
- A mutation failure shows a toast, because the user acted and needs feedback. Each write's factory takes `t` as its first argument and sets `meta.errorMessage` to that operation's message from its own namespace, such as "Couldn't delete the task"; a function of the error picks the message by failure. A failure without `errorMessage` shows the generic message.
- Each failing request gets its own toast: unrelated failures show side by side, and a request that fails again, such as a polling query, updates its toast instead of adding one.
- Leave the toast to the global handler; a component's `catch` or `onError` that toasts again shows a second one.
- When the feature handles a recoverable failure, show its recovery UI and suppress the toast for that case only, with a `suppressErrorToast` predicate in `meta`: `(error) => error instanceof ApiError && error.status === 404` for a `fetchApi` failure, or `(error) => isActionError(error, CODE)` with `isActionError` in `lib/action-result.ts` for a Server Action's. Keep other failures on the global path.
- A background write the user did not trigger sets `meta: { suppressErrorToast: true }`.
- For a policy specific to one caller, override `meta` at the call site. It replaces the factory's whole `meta`, so spread the factory's to change one field:

  ```tsx
  const options = getTodosQueryOptions();
  useQuery({ ...options, meta: { ...options.meta, suppressErrorToast: true } });
  ```

### Query states

Render a query's states in this order, data first: a failed refresh keeps its data, and checking `error` first would replace data the user can still use. The error state shows the feature's own copy, chosen from `error.code` or `error.status` when it needs to vary; `ApiError.message` in `lib/fetch.ts` is written for developers and logs.

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
