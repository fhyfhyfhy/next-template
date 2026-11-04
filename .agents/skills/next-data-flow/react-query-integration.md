# React Query integration

Use this reference when applying the official TanStack Query patterns to this repo. Start with `node_modules/next/dist/docs/01-app/02-guides/client-side-data-fetching/tanstack-query.md` for browser fetching, hydration, streaming pending queries, and Cache Components. The following are project adaptations, checked against `@tanstack/react-query` 5.104.5.

## Browser-only inputs and initial data

Choose server prefetch when the server can obtain the read's inputs; it calls the data layer, which reads the request's session itself. Otherwise fetch in the browser after readiness. This choice does not change the [data owner](SKILL.md#ownership).

For browser-only inputs, `useQuery` can wait with `enabled`. `useSuspenseQuery` has no `enabled` or `skipToken` and may fetch during server rendering, where those inputs do not exist and `fetchApi` throws. Delay mounting that consumer until browser readiness; Suspense alone does not make it browser-only. Check the installed `@tanstack/react-query/src/useSuspenseQuery.ts` and `useBaseQuery.ts` when upgrading.

## Adapt the official examples

- Import React Query APIs and types through `@/lib/react-query`, including `QueryClient`, `dehydrate`, `defaultShouldDehydrateQuery`, and `DehydratedState`. Reuse `app/providers.tsx` for the browser client and its error policy; create server prefetch clients per render/request as the guide describes. The wrapper also supplies the repo's server GC policy.
- Use feature options factories and query keys from [TanStack Query](../../../.claude/rules/tanstack-query.md). A server override of `queryFn` must return the same data represented by that key, calling the data layer as [Transport](../../../.claude/rules/data-flow.md#transport) describes.
- The guide uses `prefetchQuery`; the installed Query API deprecates it in favor of `query()`. To retain prefetch's ignored-error behavior, use `queryClient.query(options).catch(noop)`, importing `noop` from the wrapper. Await it for completed prefetch, or start it without awaiting when following the guide's pending-query dehydration pattern. Check `@tanstack/query-core/src/queryClient.ts` and `hydration.ts` for the installed contracts; with pnpm they are under `node_modules/.pnpm/@tanstack+query-core@<version>/node_modules/@tanstack/query-core/`.

Render query-owned data through subscribed query consumers, including counts or summaries beside the main list. Reading a prefetched result into a separate Server Component snapshot leaves that display unchanged when the query refetches.

## Hydration

`dehydrate` from `@/lib/react-query` directly re-exports TanStack Query's implementation. Choose the installed guide's pattern for each hydration site:

- For server prefetch and pending streaming, follow **Provide initial data from a Server Component**, including its dehydration configuration and Suspense placement.
- For prerenderable cached data, follow **Build a prerenderable hydration state** and construct the state using its helper. For tag-driven data, invalidate the cached timestamp with the same tags as the data. For time-driven data, derive data and timestamp from the same cached snapshot so they advance together. Passing `updatedAt` to `setQueryData` alone does not make native `dehydrate` prerenderable.
- The guide's Suspense boundary keeps a prerenderable state from failing the build, but Next.js then defers the consuming Client Component to the browser, so the prerendered HTML carries the data and not its rendered UI. To render that UI on the server, give the consuming query `staleTime: "static"` while `environmentManager.isServer()`, and keep the browser's `staleTime` unchanged. With hydrated data, the query reads the current time only to decide staleness, and `"static"` skips that read. Verify that the UI shows with the app's scripts blocked, as [e2e.md](../../../.claude/rules/e2e.md) describes. Sources: installed query-core `src/query.ts`, `isStaleByTime`, and `src/queryObserver.ts`, `isStale`; recheck both when upgrading.
- A prerenderable state for an infinite query carries only its first page, with a timestamp that advances whenever a write expires its tags. A Server Action on that page that expires them returns the page rendered with such a state, and native hydration then replaces every loaded page with the first one. Pass that state only for queries the browser has no data for, as the Data demo's `SeedHydrationBoundary` does, and let React Query refresh the rest.

Boolean values of `meta.suppressErrorToast` are serializable and can remain in the transferred state. When its value is a function, omit that field from dehydrated query entries and any included mutation entries before passing state to a Client Component; keep the callback in the browser's options factory. Apply this at the hydration site, whether using native `dehydrate` or constructing state. Copy the affected entries and metadata without mutating those options, and preserve the rest of the state, including pending promises; JSON serialization is not a suitable filter. Sources: [React's serializable types](https://react.dev/reference/rsc/use-client#serializable-types), installed query-core `src/hydration.ts`.

For unexpected initial refetches, inspect the factory, call-site overrides, and `app/providers.tsx` defaults for `staleTime` and refetch policies. Next.js `cacheLife` does not configure query freshness. Read the installed query-core `src/types.ts` JSDoc for these options.

## Server Action errors

For a mutation calling a Server Action, follow [Server data: Server Actions](../../../.claude/rules/server-data.md#server-actions) for the action and its `ActionResult`, [TanStack Query: Mutations](../../../.claude/rules/tanstack-query.md#mutations) for the factory that unwraps it, and [Refresh coordination](refresh.md#after-a-write) for the success path.

Expected failures come back as a value because a thrown server error does not preserve its `DomainError` class or custom fields across Flight, and production also hides its message. Returning the `ApiErrorObject` that a failed Route Handler response carries gives the browser the same `code` and `params` from a failed read or write.

React Query treats every resolved value as success, including `{ ok: false }`. `unwrapActionResult` throws an `ActionError` for it instead, so failed writes do not run the factory's or caller's `onSuccess`. A plain action consumer branches on the result directly.

Suppress the toast for a recoverable failure in the factory's `meta` and present it in the component, as [Toasts](../../../.claude/rules/data-flow.md#toasts) describes. Other failures continue through the global handler.

Sources: installed Next.js `01-getting-started/10-error-handling.md` (Server Functions) and `02-guides/server-actions.md` (Security); `emitErrorChunk` in `next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-server.browser.production.js`; installed query-core `src/mutation.ts`, `execute`.
