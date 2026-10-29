# Framework documentation differences

These notes qualify specific claims in the bundled Next.js 16.4.3 documentation. Read the official guide first and use only the note relevant to the change. Recheck against the installed version on upgrades; remove a note when the official text accurately describes that version. New notes need a concrete conflicting claim and source or reproduction evidence.

Doc paths below are relative to `node_modules/next/dist/docs/01-app/`; implementation paths are relative to `node_modules/next/dist/`. These are version-specific observations, not additional framework guarantees.

## Server Action invalidation

**Documentation issue:** `03-api-reference/04-functions/cacheLife.md`, “Client cache behavior,” says all listed revalidation functions immediately clear the entire client cache. The 16.4 action protocol distinguishes the following cases:

| Operation in a client-dispatched Server Action | Relevant difference |
| --- | --- |
| `revalidateTag(tag, "max")` alone | Marks tagged data stale without requesting updated page output in that action response or immediately invalidating client prefetches |
| `refresh()` from `next/cache` | Refreshes dynamic data and evicts the back/forward cache while preserving the prefetch cache; server-cached data remains reusable |
| `updateTag`, `revalidatePath`, or cookie mutation | Invalidates client prefetches as well as refreshing the view |

An immediate-expiration profile, such as `revalidateTag(tag, { expire: 0 })`, also requests static-and-dynamic invalidation. The `"max"` observation does not apply to every profile. None of these calls invalidates React Query.

**Evidence:** `server/web/spec-extension/revalidate.js`, `revalidate` and `refresh`, choose `ActionDidRevalidateStaticAndDynamic` or `ActionDidRevalidateDynamicOnly`. `server/app-render/action-handler.js`, `executeActionAndPrepareForRender` and `addRevalidationHeader`, determine page rendering and the client signal. `client/components/router-reducer/reducers/server-action-reducer.js` invalidates the prefetch cache only for `ActionDidRevalidateStaticAndDynamic`.

**Recheck:** inspect those branches after upgrading, and verify the affected view plus a previously prefetched destination in production. Remove this note when `cacheLife.md` distinguishes these operations or points to their accurate contracts.

## Crawler delivery

**Documentation issue:** `02-guides/streaming.md`, “Bots and crawlers → Cache Components,” says HTML-limited bots wait for metadata and the body can still stream. The later “Compare a bot request” example describes a particular page, but its concluding paragraph presents waiting for the full document as general bot behavior without the Cache Components qualification.

For ordinary production HTML requests to a PPR App Router route marked `PARTIALLY_STATIC`, a user agent matching the blocking-metadata rule bypasses the shell so metadata reaches `<head>`. The body may still stream afterward; observable chunks depend on pending work and transport buffering. Follow the guide's qualified Cache Components explanation.

**Evidence:** `build/templates/app-page-runtime.js` selects the `render` path with `supportsDynamicResponse` enabled when `shouldForceDynamicPPRRender` is true. `server/app-render/app-render.js`, `renderToStream`, consequently sets `waitForAllReady` to false. `server/app-render/stream-ops.node.js` pipes at shell readiness and waits for all content only when that flag is true. `lib/metadata/metadata.js`, `MetadataBlocker`, waits for metadata. Compare `03-api-reference/05-config/01-next-config-js/htmlLimitedBots.md` for the metadata contract.

**Recheck:** against `next start` and the deployment, request representative URLs with the target user agents. Check metadata placement, initial visible HTML, and deferred content arrival; JavaScript execution alone does not prove indexing. Remove this note when the example's conclusion includes the Cache Components qualification.

## Response status

**Documentation issue:** `02-guides/streaming.md`, “When does streaming start?”, says to place `notFound()` before any `await`, but its own example awaits params and an existence check first.

For page HTML responses, follow `03-api-reference/03-file-conventions/loading.md`, “Status codes,” and `03-api-reference/04-functions/not-found.md`: complete the check before response headers are committed. Account for ancestor `loading.tsx` and Suspense boundaries that can flush while the check waits. For redirects, read `03-api-reference/04-functions/redirect.md`, which distinguishes page responses from Server Actions.

With Partial Prerendering, a dynamic route whose params are not known at build time cannot meet that condition from the page: `next start` sends the prerendered App Shell with status 200 before the page reads its params, and `export const instant = false` does not change this. `notFound()` there streams the not-found UI with a `noindex` tag. For a real 404, 403, or 401 status on such a route, run the check in Proxy, as `loading.md` suggests. The Data demo's task detail accepts the streamed not-found (`app/demos/(data)/tasks/[id]/page.tsx`).

**Evidence:** on 16.4.3, `next start` answered `/demos/tasks/task-404` with `200`, `x-nextjs-prerender: 1`, and `x-nextjs-postponed: 1`, both with the existence check at the top of the page under `instant = false` and inside `params.then` under Suspense; the body carried the route's `not-found.tsx` and `<meta name="robots" content="noindex">`.

**Recheck:** verify the HTTP status against `next start`, including routes beneath ancestor loading boundaries and dynamic routes with unknown params. Remove this note when the streaming guide states the response-commitment constraint accurately.
