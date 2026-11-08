---
paths:
  - "e2e/**"
---

# E2E specs

Specs observe the app through the browser and import no application code. The data they need goes straight into the e2e database through a fixture that the feature's specs share, in a module beside them, as [`e2e/tasks.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/e2e/tasks.ts) is for the sample product's specs, built on `connectE2eDatabase` in `e2e/backend.ts`. That module also holds the page helpers its specs share.

Use `test` and `expect` in `e2e/test.ts`, or in the feature's fixture module, which extends it. Its fixtures run in every test; one fails the test when the page logs a next-intl `MISSING_MESSAGE` error. The browser's locale is `zh-CN` (`playwright.config.ts`); a test that needs another one sets `test.use({ locale })`, as `e2e/locale.spec.ts` does. `DateTime` in `components/date-time.tsx` renders dates and times in the browser's time zone after hydration: a spec that asserts one also sets `test.use({ timezoneId })`, as `e2e/date-time.spec.ts` does.

## Test data

The specs run against the e2e database that [Test databases](data-setup.md#test-databases) describes, and every spec shares it and the server's cache, one test at a time:

- A test that writes creates its own records, named with `unique` from `e2e/backend.ts`, and asserts on those; data it did not create, such as seed data, is read-only to it. On a view every test adds to, such as a paginated list or a count, assert what holds whatever else is there, or compare the value before and after.
- A record the fixture writes is a change made outside the app: a page that reads through `use cache` shows it only within its freshness bound. Create what such a page must show through the page's own UI, whose Server Action expires the cache, or let the app's refresh path for outside changes pick it up; the fixture's records suit pages that read per request.
- A background job whose work the specs don't test, such as one standing in for an outside service, stays off in the e2e server (`webServer.env` in `playwright.config.ts`); the fixture writes what it would and notifies the app the way the job does. A job whose work is behavior under test runs, and the test waits for its result with `expect.poll`.

## Hydration

Actionability checks pass on server-rendered HTML before React attaches its handlers, so a click or `setInputFiles` sent before hydration can be lost without an error. Before acting on a page, wait for a readiness signal: something only the browser renders, inside the same Suspense boundary as the control, such as data from a browser-only query. Wrap the navigation and that wait in a per-page helper, such as `openTask` in [`e2e/task-detail.spec.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/e2e/task-detail.spec.ts), which waits for a list only the browser renders. ESLint's `e2e/act-after-ready` reports an action that follows `page.goto` or `reload` before any `expect` or bare helper call; a control that only the browser renders, so finding it proves hydration, takes an `eslint-disable-next-line` comment that says so.

When the assertion observes another Suspense boundary, that boundary must be hydrated as well. An update that reaches a boundary before it hydrates discards its server-rendered content and shows the fallback, so a navigation can replace a list with its skeleton instead of keeping it on screen. Wait for a browser-only signal inside that boundary, or enter the page through a client-side navigation from another page, which renders every boundary in the browser. For that entry, wait for a browser-only signal on the starting page, then click with `clickForClientNavigation` in `e2e/browser.ts`, as `openTasksPage` in [`e2e/tasks.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/e2e/tasks.ts) does: a link clicked before hydration loads the whole page from the server, and the helper fails instead of letting the spec continue on server-rendered boundaries.

## Loading UI

| To assert | Use |
| --- | --- |
| The static shell after `page.goto`, or the prefetched UI after a `<Link>` click | `instant()` from `@next/playwright`, as in [`e2e/tasks.spec.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/e2e/tasks.spec.ts) |
| UI rendered into the server's HTML rather than by the browser, or what the server renders while the browser's own refreshes would hide it | Open the page with `openWithoutScripts` in `e2e/browser.ts`, which aborts the app's script requests, and assert the UI, as in [`e2e/feed.spec.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/e2e/feed.spec.ts). `instant()` lets browser rendering through, and disabling JavaScript also stops the inline scripts that place a Suspense boundary's content when it resolves after the shell |
| One streamed section arriving before another | Lock the table the later section reads with `holdTable` in `e2e/backend.ts`, and `page.goto(url, { waitUntil: "commit" })`: `load` fires only after the stream ends |
| The UI while a browser request or Server Action is in flight, or after it fails | `holdRequests` in `e2e/browser.ts` holds the request until the test releases it, so an optimistic update is asserted before the server answers without racing a delay; registered after `failRequests`, the released request then fails and leaves no write behind. `delayRequests` slows a request that the assertion waits out |

## Browser events

Playwright pages stay in the foreground, so a return to the tab is simulated: use `returnToTab` in `e2e/browser.ts`. Dispatch any other browser event with the real event's target and init, such as `bubbles: true`.

## Waiting

- Data changes only when the test or a background job that runs changes it: see [Test data](#test-data).
- End each wait on the event that completes it, such as `waitForServerAction` in `e2e/browser.ts` for a Server Action. A fixed wait fits only a negative assertion, "nothing else happens within N ms", and its `eslint-disable` comment gives that reason.
- To assert that the browser sent no request, record the requests with `recordRequests` in `e2e/browser.ts` before the action and check the list once the UI has answered.

## Regression specs

A spec added for a bug goes red on the commit before the fix. Run it there with `pnpm e2e:at <commit> [playwright test args]`, which tests that commit's app code with this checkout's `e2e/` and Playwright config, and keep the spec once it fails there and passes on the fix.
