# React Query integration

Use this reference when applying the official TanStack Query patterns to this repo. Start with `node_modules/next/dist/docs/01-app/02-guides/client-side-data-fetching/tanstack-query.md` for browser fetching, hydration, streaming pending queries, and Cache Components. The following are project adaptations, checked against `@tanstack/react-query` 5.104.5.

## Credentials and initial data

Choose server prefetch only when the server can obtain the inputs and send the required credential; inspect `lib/credentials-server.ts`. Otherwise fetch in the browser after readiness. This choice does not change the [data owner](SKILL.md#ownership).

For browser-only inputs or credentials, `useQuery` can wait with `enabled`. `useSuspenseQuery` has no `enabled` or `skipToken` and may fetch during server rendering, where this repo's browser credential helper has no credential. Delay mounting that consumer until browser readiness; Suspense alone does not make it browser-only. Check the installed `@tanstack/react-query/src/useSuspenseQuery.ts` and `useBaseQuery.ts` when upgrading.

## Adapt the official examples

- Import React Query APIs and types through `@/lib/react-query`, including `QueryClient`, `dehydrate`, `defaultShouldDehydrateQuery`, and `DehydratedState`. Reuse `app/providers.tsx` for the browser client and its error policy; create server prefetch clients per render/request as the guide describes. The wrapper also supplies the repo's server GC policy.
- Use feature options factories and query keys from [API modules](../../../.claude/rules/data-fetching-api.md). A server override of `queryFn` must return the same data represented by that key. For this app's own Route Handlers, call their data functions on the server instead of issuing same-app HTTP requests; see the installed `02-guides/backend-for-frontend.md`, Caveats.
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

For a mutation calling a Server Action, follow [API modules: Server Actions](../../../.claude/rules/data-fetching-api.md#server-actions) for module boundaries and [Refresh coordination](refresh.md#after-a-write) for the success path.

Validate inputs and authorize the write inside the action. Handle expected, recoverable `ApiError` codes there and return a serializable union such as `{ ok: true, data }` or `{ ok: false, code }`, exposing only browser-safe fields. Leave unexpected errors thrown. A thrown server error does not preserve its `ApiError` class or custom fields across Flight; production also hides its message.

In the factory's `mutationFn`, await the action result, return its data on success, and throw a feature-local `Error` carrying the safe code on expected failure. React Query treats every resolved value as success, including `{ ok: false }`; the adapter ensures failed writes do not run the factory's or caller's `onSuccess`. A plain action consumer branches on the result directly.

Configure shared suppression through the factory's [error policy](../../../.claude/rules/data-fetching-api.md#error-policy); the component follows [consumer error handling](../../../.claude/rules/data-fetching.md#errors-in-react-queryowned-data) to present recoverable errors. Other failures continue through the global handler.

Sources: installed Next.js `01-getting-started/10-error-handling.md` (Server Functions) and `02-guides/server-actions.md` (Security); `emitErrorChunk` in `next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-server.browser.production.js`; installed query-core `src/mutation.ts`, `execute`.
