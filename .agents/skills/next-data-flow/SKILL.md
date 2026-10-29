---
name: next-data-flow
description: Choose RSC or React Query ownership and coordinate server data in this repo. Use when choosing or changing a data owner, integrating server-prefetched queries or Server Actions with React Query, or diagnosing stale views after URL, write, or session changes. Framework-only questions and shell or prefetch optimization use the installed Next.js docs and official skills.
---

# Project data flow

Each piece of displayed server data has one **owner** responsible for refreshing it: the Server Component render or the browser's React Query cache. This is the repo's design convention. Ownership is separate from where the first fetch runs, whether data is cached, and which component code reaches the browser.

For a new flow, identify its consumers, inputs, available credentials, update triggers, freshness tolerance, and initial-display requirements. For an existing flow, trace the affected read through its consumers and refresh triggers; retain its owner unless the requirement calls for a change. Diagnose stale views by identifying the owner and cache that supplied the value.

## Ownership

The Server Component render owns the data unless a React Query signal applies:

| Signal | Owner |
| --- | --- |
| Changes on navigation or after this user's own write, including filters, sorting, or pagination changed in one click or selection | Server Component |
| Needs the signed-in user, and the Next.js server cannot send their credential (`lib/credentials-server.ts`) | React Query |
| Updates while the user stays: polling, progress, notifications, other users' edits | React Query |
| Re-requested as the user types, where routing every change through RSC navigation would lag | React Query |
| Infinite scroll appending pages | React Query |
| Several client components need the same record updated together, optimistically | React Query |
| Should refresh when the tab regains focus | React Query |
| Needs browser-only inputs, such as geolocation or `localStorage` | Client fetch, usually React Query |

Interactive Client Components can display server-owned props or promises. Server prefetch can seed query-owned data; its subscribed Client Component then renders that data. A separate server-rendered snapshot of the same query-owned item can diverge when the query refetches. One page may contain both owners, with each affected display refreshed through its owner.

## Project integration

- Follow [data-fetching.md](../../../.claude/rules/data-fetching.md) for data consumption, error feedback, and session isolation; follow [data-fetching-api.md](../../../.claude/rules/data-fetching-api.md) for request configuration, credentials, options factories, and feature public entries. Adapt official examples to these contracts.
- For browser credential readiness, server prefetch, hydration, or a Server Action called by a mutation, read [React Query integration](react-query-integration.md).
- For URL changes, writes, or session changes, read [Refresh coordination](refresh.md).
- Before implementing one of these patterns, read its runnable reference in the [Data demo](demos.md): code and e2e spec per scenario.

## Framework guidance

Read the relevant installed documentation before implementing framework behavior. Paths below are relative to `node_modules/next/dist/docs/01-app/`; use the installed version and actual flags in `next.config.ts`. Follow links within the selected guide to the needed API. If bundled docs are missing, resolve the installed version before consulting the official online docs.

| Question | Installed documentation |
| --- | --- |
| Server/Client composition, serialized props, or promises passed to `use()` | `01-getting-started/05-server-and-client-components.md`, `02-guides/server-and-client-boundary.md`, `02-guides/streaming.md` |
| Cache scope, keys, freshness, prerendering, or a blocking-route error | `01-getting-started/08-caching.md`, `03-api-reference/04-functions/cacheLife.md`, and the error's linked guide; for cache storage behavior, read `03-api-reference/05-config/01-next-config-js/cacheHandlers.md` |
| Synchronous dynamic reads or execution that must wait for a real request | `03-api-reference/04-functions/io.md`, `03-api-reference/04-functions/connection.md` |
| App Shell versus per-link prefetch versus navigation, including `prefetch()` and `navigation()` | `02-guides/optimizing-prefetching.md` |
| Metadata, streamed content, response status, or crawler delivery | `02-guides/streaming.md`, `03-api-reference/04-functions/generate-metadata.md`; also read the [crawler](framework-notes.md#crawler-delivery) and [status](framework-notes.md#response-status) corrections when applicable |

These guides own framework mechanisms. Keep local additions limited to project contracts or [verified documentation differences](framework-notes.md), with version and evidence. Re-check those differences when upgrading; remove a note once the installed guidance covers it accurately.

## Official workflows

Use the workflow matching the requested outcome; ordinary data-flow changes use the relevant docs and integration guidance above.

| Requested outcome | Skill |
| --- | --- |
| Improve useful UI immediately available on an initial load or named client navigation | [next-cache-components-optimizer](../next-cache-components-optimizer/SKILL.md) |
| Improve content ready before a selected link is clicked, or choose its prefetch trigger or deferred work | [next-partial-prefetching-optimizer](../next-partial-prefetching-optimizer/SKILL.md) |
| Verify changed application behavior during `next dev` | [next-dev-loop](../next-dev-loop/SKILL.md), adapted to `browser-harness` through the repo's skill patch |

For an explicit Cache Components or Partial Prefetching migration, use the matching official `next-cache-components-adoption` or `next-partial-prefetching-adoption` skill. For bundle analysis, use `next-bundle-optimizer`. Install a missing workflow from [official Next.js skills](https://github.com/vercel/next.js/tree/canary/skills) using [this repo's installation and patch process](../skills-and-rules/SKILL.md), selecting a source revision compatible with the installed Next.js version. Already enabled flags do not require rerunning adoption for ordinary feature work.

## Verification

Verify the changed flow and dependent consumers: initial data, relevant URL changes and Back/Forward, successful and failed writes, and automatic refresh triggers. Check both owners when both are affected. For session changes, follow the [session checks](refresh.md#session-changes).

Use the repo's production build when server reads or rendering boundaries change, and verify cache freshness and prefetch behavior against `next start` or a production preview. A successful build or development check does not establish those behaviors. For streaming, status, or crawler requirements, check the relevant URL and `User-Agent` for status, visible HTML, metadata, and chunk delivery. Deployment-only failures use [self-hosting-audit](../self-hosting-audit/SKILL.md).

For shell or prefetch optimization, use the official optimizer's production `instant()` regression workflow. Request counts and bytes can support diagnosis or cost measurement; they do not replace its visible-UI assertions.

Report the owners, changed refresh paths, observed behavior, and anything unverified. When adding a server cache or changing prefetch policy, also report the key, lifetime, or affected links so freshness and cost choices are reviewable.
