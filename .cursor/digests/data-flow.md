---
source: .claude/rules/data-flow.md
source-sha256: e0dc3fbf1ac212feedbb264a5d9a6f65ad14c9a1db38e485d79daee9994262db
---

### Transport

- Server code (Server Components, `generateMetadata`, `use cache` reads, Server Actions, Route Handlers, `instrumentation.ts` jobs) calls the feature's server data layer, not the app's Route Handlers: a build-time prerender gets no answer, and it adds a round trip.
- A Server Component or `generateMetadata` reading per-request data awaits `connection()` from `next/server` first, or the prerender runs the query too. Inside `use cache`, calling `connection()` is an error.
- The browser reads via `fetchApi` (`lib/fetch.ts`) from Route Handlers under `/api` and writes via Server Actions; reads that poll, stream, run in parallel or may abort stay on Route Handlers, as Server Actions run one at a time.
- Raw `fetch` only for streaming, SSE or binary bodies. An app URL built outside `Link`, the router, `redirect` and `fetchApi` (which adds it) starts with `BASE_PATH` (`lib/base-path.ts`).

### URL state

- A page's state that belongs in the URL, such as filters, sorting, pagination or a search term, goes through nuqs.
- Its parsers sit once in the feature's `utils/<page>-search-params.ts`, beside a `createLoader` loader and `createSerializer` serializer; that module imports from `nuqs/server`, as Server Components use it. Client Components import `useQueryStates` from `nuqs`.
- Server Components read with the loader inside the `<Suspense>` awaiting `searchParams`. `useQueryStates` uses the same parsers inside `<Suspense>`, since it reads `useSearchParams`. Links to another state take `href` from the serializer.
- Setter options:
  - A Server Component reads it: `shallow: false`, with `startTransition` from `useTransition` marking old content `aria-busy`.
  - Only query-owned reads depend on it: `shallow: true`, the default.
  - Back should undo it: `history: "push"`; intermediate states keep `"replace"`.
  - Continuous input: `limitUrlUpdates: debounce(ms)` with `shallow: false`; query-owned reads key on `useDebouncedValue` (`@mantine/hooks`), as the hook's value stays immediate.
- A `Link` to another state calls the setter in `onNavigate` after `event.preventDefault()`, so its new value shows at once, as the setter's does.

### Server prefetch and hydration

- No module-level `QueryClient` but the browser's in `app/providers.tsx`; the server creates one per render.
- Prefetch spreads the feature's options factory into `queryClient.query()`, swapping only `queryFn` for the data layer returning what that key holds; `.catch(noop)` ignores failure. Not `prefetchQuery`.
- A hydration state built from `use cache` data gets its timestamp from the same `use cache` function as the data: hydration relies on it to tell whether the data is newer than the browser's.
- Rendering that state's UI on the server sets `staleTime: "static"` only while `environmentManager.isServer()`, keeping the browser's `staleTime`.
- An infinite query hydrated from `use cache` data holds only page one: a Client Component passes `HydrationBoundary` only queries with no browser cache data, or it replaces loaded pages.
- Each dehydrated query and mutation drops function values from `meta` at the hydration site, not in the factory: they cannot reach a Client Component.

### Copies

- Server data renders from its owner (Server Component props or promise, `useQuery` with `select`); a copy in state, context or a store stops following refreshes. Also copies, out of step with the rest of the read: a second query refetching part of it, and a Server Component rendering a result it prefetches for React Query. A form being edited may start from the data.

### Optimistic updates

- A React Query–owned value updates in the factory's `onMutate`.
- A Server Component's value uses `useOptimistic` in the triggering Client Component, set inside the transition awaiting the write, no manual rollback, rejection caught there or it hits the error boundary. Where React Query also shows it (a detail query, a list cached for another page), the factory's `onMutate` updates it there too.

### Errors in React Query–owned data

- Toast policy sits in the factory's `meta` so every caller gets it; the handler in `app/providers.tsx` shows one toast per request, updated on repeat failure.
- A query failure toasts only when data exists; a failed first load renders the error.
- Each write's factory takes `t` first and sets `meta.errorMessage` to that operation's own message from its namespace, or the toast is generic.
- A component `catch` or `onError` that toasts adds a second toast.
- A handled recoverable failure shows recovery UI and suppresses only that case with a `suppressErrorToast` predicate (`ApiError` status, or `isActionError` from `lib/action-result.ts`). Background writes the user didn't trigger set `suppressErrorToast: true`.
- A call-site `meta` spreads the factory's, which it otherwise replaces whole.
- Render data first, then error (the feature's own text), then loading: `error` first hides data a failed refresh kept.
- A retry from an error boundary calls `reset()` from `useQueryErrorResetBoundary` first, or the query keeps its error.

### Signing out

- Signing out or switching accounts discards the old session's query data and user-specific router output (prefetched pages, hydration snapshots).
