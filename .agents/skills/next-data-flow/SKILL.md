---
name: next-data-flow
description: Decide how backend data reaches the page in this repo and how it stays fresh. Use when writing or changing code that displays backend data, or a write that changes data a page displays.
---

# Project data flow

Each **read** (one request's result and everything derived from it: its fields, filtering, sorting, counts, and pagination) has one **owner** responsible for refreshing it: the Server Component render or the browser's React Query cache. This is the repo's design convention. Ownership is separate from where the first fetch runs, whether data is cached, and which component code reaches the browser.

A read's **consumers** are every display of its data and every value computed from it, on the server or in other components.

## Steps

For each read the change displays, list its consumers, inputs, update triggers, each display's **freshness bound** (how stale its data may be), and what must show on first load. Then decide, in order: [owner](#ownership), [server read](#server-read), [delivery](#delivery), [refreshes](#refreshes), and [loading and failure states](#loading-and-failures). For a read that already exists, keep each current choice unless the requirement calls for a change.

Rank every choice by two goals, in this order:

1. Each display meets its requirement, including its freshness bound, which caps every cache that can serve the display: `cacheLife` on the server and in the browser's router, and React Query's `staleTime`.
2. Within the freshness bound, useful UI shows as early as possible: on first load, on navigation, and after the user's own write.

The design is done when every consumer has all five, with a refresh path for every [update trigger](refresh.md), and consumers shown together refresh from the same trigger.

## Ownership

The Server Component render owns a read unless a React Query signal applies:

| Signal | Owner |
| --- | --- |
| Changes on navigation or after this user's own write, including filters, sorting, or pagination changed in one click or selection | Server Component |
| Updates while the user stays: polling, progress, notifications, other users' edits | React Query |
| Its inputs change too fast for a server render per change, such as text being typed | React Query |
| Infinite scroll appending pages | React Query |
| Several client components need the same record updated together, optimistically | React Query |
| Should refresh when the tab regains focus | React Query |
| Needs browser-only inputs, such as geolocation or `localStorage` | Client fetch, usually React Query |

A read can carry signals for both owners, such as URL filters and changes while the user stays. Give the whole read one owner: React Query when most of it changes continuously, such as progress, and the Server Component when changes are occasional beside navigation. The other signal becomes that owner's refresh trigger: a server-owned read refreshes on a change signal ([Changes made elsewhere](refresh.md#changes-made-elsewhere)), and a query-owned read with URL inputs derives its key from the URL ([URL changes](refresh.md#url-changes)). Different reads on one page may have different owners.

## Server read

Choose how the server reads a server-owned read, and the server prefetch of a query-owned one:

| The data | Server read |
| --- | --- |
| The same for every user, and its displays accept some lag | `use cache` with `cacheLife` within the freshness bound, and `cacheTag` when this app's writes change it |
| The same for every user, changing only on an event such as a CMS publish | `use cache` with `cacheLife("max")` and a tag that the event's handler expires |
| Must be current on every request | Per request, after `connection()` ([Transport](../../../.claude/rules/data-flow.md#transport)) |
| Depends on the session, such as the user's own records | Per request. When its cost calls for a cache, read the session outside the cached function and pass the value the result depends on as an argument. For a read that cannot move out, `use cache: private` reuses the result within one request and in the browser's router cache, never in a server cache |
| The same for every user, read at request time from a slow, rate-limited, or costly backend | `use cache: remote`, which needs a shared handler under `cacheHandlers` in `next.config.ts`; the default handler, `lib/cache-handler.mts`, keeps entries in each process's memory |

- A cached function's arguments, and the variables it closes over, form its cache key. Await `params`, `searchParams`, and cookies outside it and pass in the values the result depends on. Keep secrets out of keys and tags: Next.js stores them in plain text.
- Take the `cacheLife` profile from the freshness bound. A short `stale`, `revalidate`, or `expire` keeps the result out of the prerendered shell (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md`, Prerendering behavior); the read then streams as [Delivery](#delivery) describes, which keeps the page fast and the data current. Data that must be current on every request gains speed the same way.
- Plan who expires each tag under [Refreshes](#refreshes).

## Delivery

| The read | Delivery |
| --- | --- |
| Cached, with a lifetime the prerendered shell can include | Await it in the Server Component; it renders into the shell |
| Per request, or depends on `params`, `searchParams`, or cookies | Await it in a Server Component inside `<Suspense>`. Keep the page and layout synchronous and read `params` and `searchParams` inside the boundary |
| Server-owned, displayed by a Client Component | Start the read without awaiting it and pass the promise as a prop; the Client Component reads it with `use()` inside `<Suspense>`. Components that display the same read share one promise |
| Query-owned, with inputs the server has | Prefetch it on the server and hydrate, so its data arrives with the page rather than after hydration ([Server prefetch and hydration](../../../.claude/rules/data-flow.md#server-prefetch-and-hydration)); the data layer reads the request's session itself |
| Query-owned, with inputs that exist only in the browser | Fetch it in the browser once they exist ([Queries](../../../.claude/rules/tanstack-query.md#queries)) |

Show what the first view needs first. Render everything that waits for no read at once, await only the reads the first view needs, and stream the rest behind their own boundaries, a query-owned read as an unawaited prefetch. Start independent reads together, each in its own component or all before the first `await`: awaiting one before starting the next runs them in sequence.

Place each `<Suspense>` close to the read it waits for, with a fallback the size of the finished content. A boundary high in the tree, such as a route's `loading.tsx`, satisfies Cache Components' build check but replaces the whole page with one skeleton. A missing record that must answer 404 is checked before any boundary ([Response status](framework-notes.md#response-status)).

## Refreshes

Give every consumer a refresh path for each update trigger it has: URL changes, this user's writes, changes made elsewhere, and session changes, as [Refresh coordination](refresh.md) describes.

## Loading and failures

- Loading: a server-owned read shows its Suspense fallback; a query-owned read renders its states as [Query states](../../../.claude/rules/data-flow.md#query-states) describes.
- Failure: a server-owned read's error reaches the segment's `error.tsx`, and a missing record calls `notFound()`; a query-owned read follows [Errors in React Query–owned data](../../../.claude/rules/data-flow.md#errors-in-react-queryowned-data).

## Project integration

- When writing the code, follow the rules: [data-flow.md](../../../.claude/rules/data-flow.md), [tanstack-query.md](../../../.claude/rules/tanstack-query.md) for browser requests and options factories, and [server-data.md](../../../.claude/rules/server-data.md) for the data layer, Server Actions, `use cache` reads, and Route Handlers. Adapt official examples to them.
- Before implementing one of these patterns, read its working version in the [sample product](examples.md): code and e2e spec per scenario.

## Framework guidance

Read the relevant installed documentation before implementing framework behavior. Paths below are relative to `node_modules/next/dist/docs/01-app/`; use the installed version and actual flags in `next.config.ts`. If bundled docs are missing, resolve the installed version before consulting the official online docs.

| Question | Installed documentation |
| --- | --- |
| Server/Client composition, serialized props, or promises passed to `use()` | `01-getting-started/05-server-and-client-components.md`, `02-guides/server-and-client-boundary.md`, `02-guides/streaming.md` |
| Cache scope, keys, freshness, prerendering, or a blocking-route error | `01-getting-started/08-caching.md`, `03-api-reference/01-directives/use-cache.md` and its `-private` and `-remote` pages, `03-api-reference/04-functions/cacheLife.md`, and the error's linked guide; for cache storage behavior, read `03-api-reference/05-config/01-next-config-js/cacheHandlers.md` |
| Caching data that depends on the session | `02-guides/authentication-with-cache-components.md` |
| Synchronous dynamic reads or execution that must wait for a real request | `03-api-reference/04-functions/io.md`, `03-api-reference/04-functions/connection.md` |
| App Shell versus per-link prefetch versus navigation, including `prefetch()` and `navigation()` | `02-guides/optimizing-prefetching.md` |
| Metadata, streamed content, response status, or crawler delivery | `02-guides/streaming.md`, `03-api-reference/04-functions/generate-metadata.md`; also read the [crawler](framework-notes.md#crawler-delivery) and [status](framework-notes.md#response-status) corrections when applicable |

These guides own framework mechanisms. Keep local additions limited to project contracts or [verified documentation differences](framework-notes.md), with version and evidence. Re-check those differences when upgrading; remove a note once the installed guidance covers it accurately.

## Official Next.js skills

These skills come from the Next.js repository ([vercel/next.js `skills/`](https://github.com/vercel/next.js/tree/canary/skills)). The first three are installed in `.agents/skills/`, with their sources in `skills-lock.json`. Use one when the request asks for its outcome:

| Requested outcome | Skill |
| --- | --- |
| Make useful UI show immediately on an initial load or a named client navigation | [next-cache-components-optimizer](../next-cache-components-optimizer/SKILL.md) |
| Make content ready before a selected link is clicked, or choose its prefetch trigger or deferred work | [next-partial-prefetching-optimizer](../next-partial-prefetching-optimizer/SKILL.md) |
| Verify changed application behavior during `next dev` | [next-dev-loop](../next-dev-loop/SKILL.md), adapted to `browser-harness` through the repo's skill patch |
| Migrate to Cache Components or to Partial Prefetching | `next-cache-components-adoption` or `next-partial-prefetching-adoption`, not installed |
| Analyze the bundle | `next-bundle-optimizer`, not installed |

Install a missing skill using [this repo's installation and patch process](../skills-and-rules/SKILL.md), from a source revision compatible with the installed Next.js version. Both flags are already enabled in `next.config.ts`, so ordinary feature work needs no adoption skill.

## Verification

Verify the changed flow and dependent consumers: initial data, relevant URL changes and Back/Forward, successful and failed writes, automatic refresh triggers, and changes made elsewhere while the view stays open, observed in every consumer. Check both owners when both are affected. For session changes, follow the [session checks](refresh.md#session-changes).

Use the repo's production build when server reads or rendering boundaries change, and verify cache freshness and prefetch behavior against `next start` or a production preview. A successful build or development check does not establish those behaviors. In that build, check what shows first on initial load and on navigation, judged by the UI the user sees, and that no display serves data older than its freshness bound. Request counts and bytes measure cost only. For streaming, status, or crawler requirements, check the relevant URL and `User-Agent` for status, visible HTML, metadata, and chunk delivery. Deployment-only failures use [self-hosting-audit](../self-hosting-audit/SKILL.md).

Report the owners, what shows first, changed refresh paths, observed behavior, and anything unverified. When adding a server cache or changing prefetch policy, also report the key, the lifetime beside the freshness bound it serves, or the affected links, so freshness and cost choices are reviewable.
