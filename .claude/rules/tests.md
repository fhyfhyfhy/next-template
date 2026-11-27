---
paths:
  - "app/**"
  - "features/**"
  - "components/**"
  - "hooks/**"
  - "lib/**"
  - "utils/**"
  - "constants/**"
  - "types/**"
  - "scripts/**"
  - "e2e/**"
  - "**/*.test.*"
  - "instrumentation.ts"
  - "proxy.ts"
---

# Tests

A test goes red when the behavior it covers breaks, and stays green through changes that keep that behavior.

## What to test

Every behavior a change adds, changes, or fixes has a test that goes red when it breaks, in the change or already in the repo. A bug fix brings a regression test: write it first and run it red, then fix the bug and run it green. An e2e spec written after the fix runs red on the commit before it, as [Regression specs](e2e.md#regression-specs) describes.

Test each behavior once, at the level where its failure shows:

| Behavior | Test |
| --- | --- |
| A pure rule, such as a function in `utils/` | A unit test in a `*.test.ts` beside the module |
| What a component or hook renders, such as markup, attributes, and text | A unit test in a `*.test.tsx` beside the module that renders it with `renderToString` from `react-dom/server`, as `components/date-time.test.tsx` does, and a hook through a probe component, as `hooks/use-hydrated.test.tsx` does. Unit tests run without a DOM, so effects and events belong to the browser row |
| A rule of a feature's data layer in `server/` | A `*.db.test.ts` beside the module, against the real database ([Tests](server-data.md#tests)) |
| What only a browser shows, such as hydration, streaming, caching, navigation, and focus | An e2e spec ([e2e.md](e2e.md)) |

Cover the cases that matter for the behavior, such as empty and boundary values, invalid input, a failing dependency, and the concurrent writes the code guards against. Each test checks one behavior, and its description names it.

## Assertions

- Assert outcomes through the public interface of the code under test: what users see, what callers receive, or what is stored. A refactor that keeps the behavior then keeps the test green.
- Break the behavior, in your head or in the code, and find the assertion that goes red. An assertion on text shown elsewhere on the page, on a loading state the broken version shows too, or on a value the fixture already had stays green either way.

## Determinism

Each test gives the same result in any order and at any time. Time and data come from the test's own setup, such as fake timers or records the test creates for itself, and each wait ends on the event that completes it ([Waiting](e2e.md#waiting)).

## Dependencies

- Run against the real dependency where the repo provides one, such as the databases in [Test databases](data-setup.md#test-databases).
- Stand in for a dependency only at a boundary the tests can't run, such as an outside service. Intercept it from the test, as `e2e/browser.ts` intercepts requests, and make it answer as the real one does.
- Reuse the existing fixtures and helpers, and share setup between tests.
- Run new tests through the existing test entries, choosing their scope with the runner's arguments, such as a Vitest project or a file path. Add an entry only for tests whose execution setup differs, as the e2e specs need a running server.
