---
paths:
  - "e2e/**"
---

# E2E specs

## Hydration

Actionability checks pass on server-rendered HTML before React attaches its handlers, so a click or `setInputFiles` sent before hydration can be lost without an error. Before acting on a page, wait for a readiness signal: something only the browser renders, inside the same Suspense boundary as the control, such as data from a browser-only query. Wrap the navigation and that wait in a per-page helper, like `openTask` in `e2e/demo/task-detail.spec.ts`. ESLint's `e2e/act-after-ready` reports an action that follows `page.goto` or `reload` before any `expect` or bare helper call; a control that only the browser renders, so finding it proves hydration, takes an `eslint-disable-next-line` comment that says so.

When the assertion observes another Suspense boundary, that boundary must be hydrated as well. An update that reaches a boundary before it hydrates discards its server-rendered content and shows the fallback, so a navigation can replace a list with its skeleton instead of keeping it on screen. Wait for a browser-only signal inside that boundary, or enter the page through a client-side navigation, which renders every boundary in the browser, as `openTasksPage` in `e2e/demo/tasks.spec.ts` does.

## Loading UI

| To assert | Use |
| --- | --- |
| The static shell after `page.goto`, or the prefetched UI after a `<Link>` click | `instant()` from `@next/playwright`, as in `e2e/demo/tasks.spec.ts` |
| UI rendered into the server's HTML rather than by the browser | Abort the app's script requests and assert the UI, as in `e2e/demo/feed.spec.ts`. `instant()` lets browser rendering through, and disabling JavaScript also stops the inline scripts that place a Suspense boundary's content when it resolves after the shell |
| One streamed section arriving before another | A Mock API `latency_ms` fault on the later one, and `page.goto(url, { waitUntil: "commit" })`: `load` fires only after the stream ends |
| A browser-side query's loading state | A `latency_ms` fault on its request; `instant()` holds back only server-rendered content |

## Browser events

Playwright pages stay in the foreground, so a return to the tab is simulated: use `returnToTab` from `e2e/browser.ts`. Dispatch any other browser event with the real event's target and init, such as `bubbles: true`.

## Waiting

- Task state changes only through `mockApi.advance()`: the `mockApi` fixture pauses the Mock API clock.
- End each wait on the event that completes it, such as `page.waitForResponse` for a Server Action. A fixed wait fits only a negative assertion, "nothing else happens within N ms", and its `eslint-disable` comment gives that reason.
- `mockApi.requests()` reads once. Poll it with `expect.poll` when the browser sends the request; read it directly for requests made while the server renders, which finish before the HTML arrives.
