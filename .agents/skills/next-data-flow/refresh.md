# Refresh coordination

Update triggers are URL changes, this user's writes, changes made elsewhere, and session changes; each has a section below. Map each changed input or record to its [consumers](SKILL.md) and [owners](SKILL.md#ownership). Next.js server caches, router output, and React Query have separate refresh paths; updating one does not establish freshness in the others.

## URL changes

| Affected data owner | Coordinate the update |
| --- | --- |
| Server Component | Navigate with `Link`, `router.push`, or `router.replace`; feed the page's URL input into its read |
| React Query only | Update URL state shallowly and derive the query key from it; the query follows its own freshness policy |
| Both | Navigate and derive the query key from the resulting URL; a shallow-only update leaves the server output unchanged |

Use the same committed URL input for both owners. Debounce typed filters before committing them to the URL and query key; use `replace` for intermediate states and `push` for choices the user expects Back to undo.

A Server Component navigation that misses the server cache waits for the server. Until it commits, the URL and server-rendered props keep their previous values, and React keeps the content already on screen instead of showing its Suspense fallback, so a control derived from those props does not react to the click. To show the choice at once, call `router.push` inside `startTransition` and set the chosen value there with `useOptimistic`: it lasts until the navigation commits. Mark the previous content `aria-busy` meanwhile. For a `Link`, take over in `onNavigate` with `preventDefault()`, not `onClick`, so modifier clicks still open a new tab.

For History API integration, read `node_modules/next/dist/docs/01-app/02-guides/single-page-applications.md`, **Shallow routing**. For parameter access and Suspense requirements, read the installed `03-api-reference/04-functions/use-search-params.md`. Navigation can reuse existing output; verify the displayed values and Back/Forward behavior rather than assuming every URL change sends a request.

## After a write

First confirm where the write's inputs and credentials are available. A read's owner determines which display must refresh, but does not guarantee that the same environment can perform the write.

| Affected data owner | Default write path when eligible | After success |
| --- | --- | --- |
| Server Component | Server Action | Invalidate affected server-cached reads as needed and request updated server output |
| React Query | Feature `mutationOptions` factory, consumed through `useMutation` | Update or invalidate the affected queries in the factory's `onSuccess` |
| Both | Factory whose `mutationFn` calls a Server Action | Action refreshes the server-owned data; factory refreshes the queries |

For the combined path, adapt expected action failures as [React Query integration](react-query-integration.md#server-action-errors) describes so only successful writes reach `onSuccess`. Factory/caller callback responsibilities remain in [API modules](../../../.claude/rules/data-fetching-api.md#mutations).

When only the browser can perform the write, use a client mutation and coordinate the server-owned displays after success. `router.refresh()` requests the current route again but leaves server caches reusable; cached reads also need an authorized invalidation path. If that path is unavailable, revisit the affected view's owner or cache policy.

Optimistic updates follow the owner of the displayed value:

- **Server Component**: call the Server Action inside a transition and set the value with `useOptimistic`. The optimistic value lasts until the transition ends, so a failure falls back to the server's value without rollback code. Catch the action's rejection inside the transition and give feature feedback; an uncaught rejection reaches the nearest error boundary.
- **React Query**: in the factory's `onMutate`, cancel the affected queries, snapshot them, and write the new value into every displayed copy; restore the snapshot in `onError` and invalidate in `onSettled`. Failure feedback stays with the global toast.

When both owners display the value, combine the React Query path with a factory `mutationFn` that calls the Server Action.

## Changes made elsewhere

Data can change without this user acting: other users' edits, background jobs, or processing that advances on its own.

| Affected data owner | Coordinate the update |
| --- | --- |
| React Query | Poll while the data can change (`refetchInterval`), refetch on focus, or invalidate on a pushed event |
| Server Component | Invalidate the cached reads from the backend's change event, such as `revalidateTag` in a Route Handler; refresh open views from a change signal |

A **change signal** is a cheap query or pushed event that reveals a change to the view: a version, a count, or the IDs and states the view depends on. Compare successive results and refresh only when they differ. When the backend has invalidated the cached reads, `router.refresh()` updates an open view. When only the browser can detect the change, call a Server Action that invalidates them; its response carries the refreshed page. Every open page then sends that action, so prefer the backend event when the backend can emit one. Choose the invalidation's freshness as [Server invalidation and refresh](#server-invalidation-and-refresh) describes.

A stale-while-revalidate read can reach the page older than the signal's first result. Check the view against that first result once and refresh if they disagree.

## Server invalidation and refresh

Read `node_modules/next/dist/docs/01-app/01-getting-started/09-revalidating.md` and the relevant `updateTag`, `revalidatePath`, `revalidateTag`, `refresh`, or `use-router` API page under `03-api-reference/04-functions/`. Choose according to the written data, cache tags/paths, and required freshness. Also read the [Server Action invalidation correction](framework-notes.md#server-action-invalidation) before relying on what an action response refreshes or which client prefetches it invalidates.

Preserve the distinction between the Server Action `refresh()` API and the client `router.refresh()`, and between stale-while-revalidate and read-your-own-writes. Next.js invalidation does not invalidate React Query; coordinate both for displays or hydration payloads that could otherwise restore stale data.

Verify initial load, the write or URL change, and revisiting affected views, including Back/Forward, with the relevant cache state.

## Session changes

On sign-out or an account switch, `queryClient.clear()` clears only React Query; user-specific router output, including prefetched pages and hydration snapshots, can otherwise hydrate the previous user's data back into it. A full-page navigation after changing the session resets both client caches.

For an in-app transition, coordinate `queryClient.clear()` with the session's server refresh and router-cache invalidation before showing the new account. Cookie changes in a Server Action participate in [Next.js invalidation](framework-notes.md#server-action-invalidation); a backend or Route Handler response that changes a cookie does not itself run that Server Action path.

Verify that revisiting a page, including Back/Forward, cannot restore the previous session's data.
