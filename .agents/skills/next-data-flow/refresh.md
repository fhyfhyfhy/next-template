# Refresh coordination

Update triggers are URL changes, this user's writes, changes made elsewhere, and session changes; each has a section below. Map each changed input or record to its [consumers](SKILL.md) and [owners](SKILL.md#ownership). Next.js server caches, router output, and React Query have separate refresh paths; updating one does not establish freshness in the others.

## URL changes

| Affected data owner | Coordinate the update |
| --- | --- |
| Server Component | Navigate with a `Link` or a URL update that renders on the server ([URL state](../../../.claude/rules/data-flow.md#url-state)), and pass the URL values the read depends on, such as a filter from `searchParams`, to the read as arguments |
| React Query only | Update the URL without a server render and derive the query key from it; the query follows its own freshness policy |
| Both | Navigate, and derive the query key from the resulting URL; an update without a server render leaves the server output unchanged |

Use the same committed URL input for both owners. Debounce an input that changes continuously, such as typing, before it reaches a request: the query key, or a URL update that renders on the server. Replace the history entry for intermediate states, and push one for choices the user expects Back to undo.

Every choice responds at once. A navigation that misses the server cache waits for the server; until it commits, the URL and server-rendered props keep their previous values, and React keeps the previous content on screen instead of a Suspense fallback. Show the chosen value immediately with an optimistic value that lasts until the navigation commits, and mark the previous content busy meanwhile. [URL state](../../../.claude/rules/data-flow.md#url-state) writes these choices.

Navigation can reuse output the router already holds: verify the displayed values and Back/Forward rather than assuming every URL change sends a request. For how a URL update without a server render works, read `node_modules/next/dist/docs/01-app/02-guides/single-page-applications.md`, **Shallow routing**.

## After a write

Every write from the browser runs in a Server Action ([Server data: Server Actions](../../../.claude/rules/server-data.md#server-actions)), so first confirm its inputs can reach one: an action receives serializable arguments within its request body limit, so a file goes from the browser straight to object storage and the action then records it, as `updateTaskCover` in [`features/task/api/update-task-cover.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/features/task/api/update-task-cover.ts) does for the sample product's cover. A Client Component triggers it through the feature's options factory ([Mutations](../../../.claude/rules/tanstack-query.md#mutations)). A read's owner determines which display must refresh:

| Affected data owner | After success |
| --- | --- |
| Server Component | The action invalidates the affected server-cached reads, and its response carries the updated page. When the affected reads are per request, with no server cache to invalidate, the action calls `refresh()` from `next/cache`: an action that calls no invalidation API returns no page |
| React Query | The factory's `onSuccess` updates or invalidates the affected queries |
| Both | Both of the above |

When part of the write happens only in the browser, such as the direct upload, run it inside the mutation before calling the action, and coordinate the server-owned displays after success. `router.refresh()` requests the current route again but leaves server caches reusable; cached reads also need an authorized invalidation path, usually the write's Server Action calling `updateTag`, or a Route Handler calling `revalidateTag` for an event from outside the app. If that path is unavailable, revisit the affected view's owner or cache policy.

On a page that React Query owns, the action's `updateTag` still renders the current page into the action response, so the page's server reads run once more although the browser keeps its own queries ([Server Action invalidation](framework-notes.md#server-action-invalidation)). Accept that read rather than splitting the write path, and keep the page's hydration from replacing the browser's data, as [Server prefetch and hydration](../../../.claude/rules/data-flow.md#server-prefetch-and-hydration) describes for infinite queries.

### Optimistic updates

Show a write's result at once by default, before the server confirms it, whenever the browser can predict that result, such as a toggled flag, an edited field, or a removed item. When the result comes from the server, such as an assigned number or a stock check, show the write as pending until it settles. Update every copy the user can see, including query-owned copies cached for other pages: [Optimistic updates](../../../.claude/rules/data-flow.md#optimistic-updates) writes each owner's way.

## Changes made elsewhere

Data can change without this user acting: other users' edits, background jobs, or processing that advances on its own.

| Affected data owner | Coordinate the update |
| --- | --- |
| React Query | Poll while the data can change (`refetchInterval`), refetch on focus, or invalidate on a pushed event |
| Server Component | Invalidate the cached reads from the backend's change event, such as `revalidateTag` in a Route Handler; refresh open views from a change signal |

Set the polling interval, and how often a change signal is checked, from the [freshness bound](SKILL.md#steps) of the displays involved.

A server-owned view whose freshness bound is "current as of the last navigation or write" needs no change signal. Its page can then be out of date when the user acts on it, so a write refused because of that refreshes the page too: the action refreshes on each refusal that only an out-of-date page can cause, such as a record changed or removed meanwhile, or an authorization failure on a control the page shows only to someone allowed to use it. The refresh shows the user what is now true in place of a control that would be refused again, at the cost of what they had typed; a refusal about the input itself leaves the page as it is.

A **change signal** is a cheap query or pushed event that reveals a change to the view: a version, a count, or the IDs and states the view depends on. Compare successive results and refresh only when they differ. When the backend has invalidated the cached reads, `router.refresh()` updates an open view. When only the browser can detect the change, call a Server Action that invalidates them; its response carries the refreshed page. Every open page then sends that action, so prefer the backend event when the backend can emit one. Choose the invalidation's freshness as [Server invalidation and refresh](#server-invalidation-and-refresh) describes.

A stale-while-revalidate read can reach the page older than the signal's first result. Check the view against that first result once and refresh if they disagree.

## Server invalidation and refresh

Read `node_modules/next/dist/docs/01-app/01-getting-started/09-revalidating.md` and the relevant `updateTag`, `revalidatePath`, `revalidateTag`, `refresh`, or `use-router` API page under `03-api-reference/04-functions/`. Choose according to the written data, cache tags/paths, and the displays' freshness bound. Also read the [Server Action invalidation correction](framework-notes.md#server-action-invalidation) before relying on what an action response refreshes or which client prefetches it invalidates.

Preserve the distinction between the Server Action `refresh()` API and the client `router.refresh()`, and between stale-while-revalidate and read-your-own-writes. Next.js invalidation does not invalidate React Query; coordinate both for displays or hydration payloads that could otherwise restore stale data.

## Session changes

On sign-out or an account switch, `queryClient.clear()` clears only React Query; user-specific router output, including prefetched pages and hydration snapshots, can otherwise hydrate the previous user's data back into it. A full-page navigation after changing the session resets both client caches.

For an in-app transition, coordinate `queryClient.clear()` with the session's server refresh and router-cache invalidation before showing the new account. Cookie changes in a Server Action participate in [Next.js invalidation](framework-notes.md#server-action-invalidation); a backend or Route Handler response that changes a cookie does not itself run that Server Action path.

Verify that revisiting a page, including Back/Forward, cannot restore the previous session's data.
