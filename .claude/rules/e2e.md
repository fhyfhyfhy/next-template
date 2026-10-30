---
paths:
  - "e2e/**"
---

# E2E specs

`eslint-plugin-playwright` covers the mechanical checks. These are the calls it can't make.

## Hydration

Playwright's actionability checks don't cover hydration: a control rendered only as HTML accepts clicks and `setInputFiles` and does nothing. Before acting on a page, wait for a signal only the browser produces, inside the same Suspense boundary as the control, such as data from a browser-only query. Wrap the navigation and the wait in a per-page helper, like `openTask` in `e2e/demo/task-detail.spec.ts`. `load` and `window.__NEXT_HYDRATED` don't mark hydration.

## Loading UI

- What a page shows before its request-time content arrives, the static shell after `page.goto` or the prefetched UI after clicking a `<Link>`, is asserted inside `instant()` from `@next/playwright`, as `e2e/demo/tasks.spec.ts` does. It holds back only server-rendered content. Both Playwright configs build with the testing API it needs; a server reused through `E2E_REUSE_SERVER` must be `next dev` or a build made with `EXPOSE_TESTING_API=1`.
- To show that one streamed section doesn't wait for another, delay the later one with a Mock API `latency_ms` fault and open the page with `waitUntil: "commit"`: `load` fires only after the stream ends.
- Loading states of browser-side queries appear after `load`; delay the request with a `latency_ms` fault to observe them.

## Browser events

Playwright pages stay in the foreground. Simulate a return to the tab with `returnToTab` from `e2e/browser.ts`. When dispatching another browser event, give it the real event's target and init: `new Event()` doesn't bubble by default.

## Time

The `mockApi` fixture pauses the Mock API clock, so task state moves only through `mockApi.advance()`. End each step on the event that completes it: a response (`page.waitForResponse`), a UI change, or `expect.poll`. A fixed wait belongs only in a negative assertion, "nothing else happens within N ms"; disable `playwright/no-wait-for-timeout` on that line with the reason.

## Server-side counts

`mockApi.requests()` reads once. When the browser sends the request, wrap the read in `expect.poll`. Requests made while the server renders finish before the HTML arrives and can be read directly.
