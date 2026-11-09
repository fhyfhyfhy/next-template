---
source: .claude/rules/e2e.md
source-sha256: 1b515bdc7d3bf15ad65c3906425538107daa84eb7849beaa2cdb7619c632aaa3
---

- A feature's specs share one fixture module beside them, built on `connectE2eDatabase` in `e2e/backend.ts`, for their data and page helpers.
- A locale other than `zh-CN` needs `test.use({ locale })`. Asserting a `DateTime` value needs `test.use({ timezoneId })`: it renders in the browser's time zone.
- A writing test creates its own records, named with `unique`, and asserts on those; data it did not create, such as seed data, is read-only. On a view every test adds to (list, count), assert what holds whatever else is there, or compare before and after.
- A `use cache` page shows a fixture-written record only within its freshness bound: create what it must show through its UI, or let the app's refresh path for outside changes pick it up.
- A background job not under test stays off (`webServer.env`), the fixture writing and notifying as it would; one under test runs, awaited with `expect.poll`.
- Before acting on a page, a per-page helper waits for something only the browser renders, in the control's Suspense boundary: an action before hydration can be lost. A browser-only control proves hydration itself: acting on it at once takes an `eslint-disable-next-line` comment saying so.
- A test asserting on another Suspense boundary waits for a browser-only signal inside it, or enters via `clickForClientNavigation` from a page showing one: an update to an unhydrated boundary shows its fallback.
- Loading UI:
  - Static shell or prefetched UI: `instant()`.
  - Server-rendered UI: `openWithoutScripts`, not `instant()` or disabled JavaScript.
  - Stream order: `holdTable` and `waitUntil: "commit"`.
  - A request in flight: `holdRequests`, not a racing delay; for a failure, after `failRequests`. `delayRequests` slows a request the assertion waits out.
- Return to the tab with `returnToTab`; dispatch other events with the real event's target and init, such as `bubbles: true`.
- Each wait ends on the event completing it, such as `waitForServerAction`; a fixed wait fits only "nothing else happens within N ms", its `eslint-disable` comment saying so.
- To assert no request was sent, call `recordRequests` before the action and check once the UI has answered.
