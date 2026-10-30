# Data demo

The Data demo under `/demos` is the runnable reference for this skill and its rules: a small Demo task app whose every request goes through `fetchApi` to the Mock API, a separate Node process that stands in for the backend ([ADR 0001](../../../docs/adr/0001-demos-use-standalone-mock-api.md)). Before writing a pattern listed below, read its code and spec; adapt names and keys to the real feature, and keep its owner choice only if the same signal applies.

- Run it with `pnpm demo:dev`, or `pnpm demo:build` then `pnpm demo:start` for production behavior. These scripts start the Mock API; under `pnpm dev`, `build`, and `start` it stays off, and the Data demo pages render a notice and send no requests.
- Code lives in `app/demos/(data)/` (routes) and `features/demo-task/` (paths below are relative to it unless they start with `app/` or `e2e/`). The Mock API is `scripts/mock-api/`; its `/__mock/*` endpoints reset data, pause or step the clock, inject faults, and list received requests.
- `pnpm demo:test:e2e` runs the specs in `e2e/demo/` serially against `pnpm demo:build` and `pnpm demo:start`; each test resets the Mock API first. `pnpm test:e2e` is for the project's own specs and skips them.

| Page | Owner | Why |
| --- | --- | --- |
| `/demos/tasks` | Server Component | Filters, sort, and page change on navigation; the user's own writes refresh it |
| `/demos/tasks/[id]` | React Query | A task advances while the user stays |
| `/demos/feed` | React Query | Infinite scroll; favorites update two components together |
| `/demos/search` | React Query | Re-requested as the user types |
| `/demos/recent` | React Query | Inputs come from `localStorage` |
| `/demos/lab` | React Query | Error-policy experiments |

## Scenarios

| # | Scenario | Rules | Code | Spec |
| --- | --- | --- | --- | --- |
| 1 | URL filters, sort, and pagination with a streamed skeleton | [Ownership](SKILL.md#ownership), [URL changes](refresh.md#url-changes) | `app/demos/(data)/tasks/page.tsx`, `utils/task-urls.ts`, `components/task-list-toolbar/` | `e2e/demo/tasks.spec.ts` |
| 2 | Public read in `use cache` with a tag, expired by `updateTag` after writes | [Server invalidation](refresh.md#server-invalidation-and-refresh), [Files](../../../.claude/rules/data-fetching-api.md#files), [Requests](../../../.claude/rules/data-fetching-api.md#requests) | `api/cached-reads.ts`, `constants/cache-tags.ts`, `api/*-action.ts` | `e2e/demo/tasks.spec.ts` |
| 3 | Unawaited promise passed to a Client Component and read with `use()` | Installed `02-guides/streaming.md` | `app/demos/(data)/tasks/page.tsx`, `components/task-list/index.tsx` | `e2e/demo/tasks.spec.ts` |
| 4 | Not-found, metadata sharing the page's GET, segment `error.tsx` | [Response status](framework-notes.md#response-status) | `app/demos/(data)/tasks/[id]/page.tsx`, `app/demos/(data)/tasks/[id]/not-found.tsx`, `app/demos/(data)/error.tsx` | `e2e/demo/task-detail.spec.ts`, `e2e/demo/lab.spec.ts` |
| 5 | Server prefetch with `query()`, pending query streamed through dehydration | [Adapt the official examples](react-query-integration.md#adapt-the-official-examples), [Hydration](react-query-integration.md#hydration) | `app/demos/(data)/tasks/[id]/page.tsx`, `components/task-comments/` | `e2e/demo/task-detail.spec.ts` |
| 6 | Polling while active, list refresh when the task settles | [Ownership](SKILL.md#ownership) | `api/get-task.ts`, `hooks/use-refresh-lists-when-settled.ts`, `components/data-demo-header/` | `e2e/demo/task-detail.spec.ts` |
| 7 | Search as you type: debounce, shallow URL, browser-only `signal`, previous results kept | [URL changes](refresh.md#url-changes), [Queries](../../../.claude/rules/data-fetching-api.md#queries) | `api/search-tasks.ts`, `components/task-search.tsx` | `e2e/demo/search.spec.ts` |
| 8 | Infinite scroll under the list key | [Queries](../../../.claude/rules/data-fetching-api.md#queries), [Query keys](../../../.claude/rules/data-fetching-api.md#query-keys) | `api/get-feed.ts`, `components/feed-grid/` | `e2e/demo/feed.spec.ts` |
| 9 | One record updated optimistically in two components, rolled back together | [After a write](refresh.md#after-a-write) | `api/update-task-favorite.ts`, `components/feed-grid/feed-card.tsx`, `components/favorites-panel.tsx` | `e2e/demo/feed.spec.ts` |
| 10 | Focus refetch, `select`, dependent query | [Queries](../../../.claude/rules/data-fetching-api.md#queries) | `api/get-tasks.ts`, `components/task-detail/task-heading.tsx`, `components/related-tasks.tsx` | `e2e/demo/task-detail.spec.ts` |
| 11 | Browser-only input that gates requests until hydration | [Credentials and initial data](react-query-integration.md#credentials-and-initial-data) | `hooks/use-recent-task-ids.ts`, `components/recent-tasks.tsx` | `e2e/demo/recent.spec.ts` |
| 12 | `useSuspenseQuery` error boundary reset before retry | [Errors](../../../.claude/rules/data-fetching.md#errors-in-react-queryowned-data) | `components/query-error-boundary.tsx`, `components/lab-suspense-reset.tsx` | `e2e/demo/lab.spec.ts` |
| 13 | Server Component-owned writes: `useActionState` form, `useOptimistic` toggle | [After a write](refresh.md#after-a-write), [Server Actions](../../../.claude/rules/data-fetching-api.md#server-actions) | `api/create-task.ts`, `api/create-task-action.ts`, `components/create-task-form.tsx`, `components/task-list/favorite-toggle.tsx` | `e2e/demo/tasks.spec.ts` |
| 14 | React Query-owned write with optimistic insert and delete; factory argument versus variables | [Mutations](../../../.claude/rules/data-fetching-api.md#mutations) | `api/create-comment.ts`, `api/delete-comment.ts`, `components/task-comments/` | `e2e/demo/task-detail.spec.ts` |
| 15 | Write affecting both owners: factory `mutationFn` calls a Server Action | [After a write](refresh.md#after-a-write) | `api/delete-task.ts`, `api/retry-task.ts`, their `-action.ts` modules, `components/delete-task-dialog.tsx` | `e2e/demo/task-detail.spec.ts` |
| 16 | Expected Server Action failure turned into a local error, toast suppressed for that code | [Server Action errors](react-query-integration.md#server-action-errors), [Error policy](../../../.claude/rules/data-fetching-api.md#error-policy) | `api/update-task.ts`, `api/update-task-action.ts`, `utils/task-action-error.ts`, `components/task-detail/rename-task-form.tsx` | `e2e/demo/task-detail.spec.ts` |
| 17 | Browser-only write, then server-owned displays expired through an action | [After a write](refresh.md#after-a-write) | `api/update-task-cover.ts`, `api/expire-task-list-action.ts`, `components/task-detail/task-cover-panel.tsx` | `e2e/demo/task-detail.spec.ts` |
| 18 | Editing draft that starts from the data | [Copies](../../../.claude/rules/data-fetching.md#copies) | `components/task-detail/rename-task-form.tsx` | `e2e/demo/task-detail.spec.ts` |
| 19 | First-load failure versus failed refresh; data, error, loading order | [Errors](../../../.claude/rules/data-fetching.md#errors-in-react-queryowned-data) | `components/lab-query-states.tsx`, `components/task-detail/index.tsx` | `e2e/demo/lab.spec.ts` |
| 20 | Retry for 5xx only, capped at 3; 4xx, business codes, and schema mismatches fail at once; schema mismatch logged | `shouldRetryRequest` in `lib/fetch.ts` | `components/lab-retry.tsx` | `e2e/demo/lab.spec.ts` |
| 21 | Concurrent failures share one toast; mutation failure rolls back without a second toast | [Errors](../../../.claude/rules/data-fetching.md#errors-in-react-queryowned-data) | `components/lab-concurrent-failures.tsx`, `api/create-comment.ts` | `e2e/demo/lab.spec.ts`, `e2e/demo/task-detail.spec.ts` |
| 22 | Function `suppressErrorToast` omitted from dehydrated state | [Hydration](react-query-integration.md#hydration) | `utils/hydration-state.ts`, `api/get-task.ts`, `app/demos/(data)/tasks/[id]/page.tsx` | `e2e/demo/task-detail.spec.ts` |
| 23 | SSE read with raw `fetch` and `resolveApiUrl` | [Transport](../../../.claude/rules/data-fetching.md#transport) | `api/get-task-logs.ts`, `components/task-logs/` | `e2e/demo/task-detail.spec.ts` |
| 24 | Binary download with raw `fetch` | [Transport](../../../.claude/rules/data-fetching.md#transport) | `api/get-task-model.ts`, `components/task-detail/task-actions.tsx` | `e2e/demo/task-detail.spec.ts` |
| 25 | `Link` prefetch, instant navigation to the prefetched skeleton, and Back/Forward restoring URL state | [URL changes](refresh.md#url-changes) | `components/task-list/index.tsx`, `app/demos/(data)/tasks/[id]/page.tsx` | `e2e/demo/tasks.spec.ts` |
| 26 | Prerenderable hydration state from a cached snapshot | [Hydration](react-query-integration.md#hydration) | `app/demos/(data)/feed/page.tsx`, `api/cached-reads.ts`, `utils/hydration-state.ts` | `e2e/demo/feed.spec.ts` |

Not covered: session changes and credentialed reads. The Data demo sends `auth: false` only, so the template's credential files stay untouched.
