# Code review

Project reviews for the `code-review` skill, one per section.

**Ends review rounds:** changes to comments other than tool directives such as `eslint-disable`, to test descriptions, and to the text of messages in `messages/{locale}/`, leaving their keys and ICU arguments as they are.

## Architecture

- **Runs when:** the diff changes application code (the directories in the Layers table of `.claude/rules/architecture.md`, plus `instrumentation.ts` and `proxy.ts` at the root) or `docs/features.md`. An edit inside a function body is enough, since it can give a module a second job, add an unrelated branch, or copy logic a third time.
- **Standards:** `.claude/rules/architecture.md`, "Component directories" and "Split by responsibility" in `.claude/rules/components.md`, and `docs/features.md`
- **Brief:** Review only the changes to application code and `docs/features.md`, and in them these parts of the rule; ESLint checks the rest.
  - The whole of **Single responsibility**, **Duplication and abstraction**, **Design for change**, **Where files go**, and **Shared code ownership**. Count occurrences across the repo before calling an extraction premature or overdue, and look at a changed module's callers and neighbours before judging its owner.
  - **Split by responsibility** in `components.md`, for each component the diff adds or changes.
  - **Feature boundaries**: compare the changes with `docs/features.md`: code outside its feature's responsibility, and a new feature whose concept an existing entry covers or that exists only as part of another concept or only serves one. Judge a change to `docs/features.md` itself by the same section.
  - **One-way dependencies**: when the change resolves a cycle or an upward import, the business code stays in its feature instead of moving into a root layer.
  - **Layers** and **Feature structure**: each file sits in the layer and feature subdirectory its responsibility belongs to.
  - **Component directories**: each component file or directory the diff adds or changes, against every requirement of that section.
  - **Feature public API**: a module's top level only defines, with anything that must run in a function its caller calls, and heavy dependencies go through a sub-entry.
  - Each `eslint-disable` the diff adds for `architecture/*`, `import/no-restricted-paths`, or `import/no-cycle`: whether its description justifies the exception.

## Data flow

- **Runs when:** the diff changes how backend data is read, written, cached, or shown: a feature's `api/`, `server/`, or `server.ts`, `app/api/`, the database schema, an environment variable, or a page or component that reads or writes data, such as one that calls the data layer, `useQuery`, `useMutation`, or `useQueryStates`.
- **Standards:** `.claude/rules/data-flow.md`, `.claude/rules/server-data.md`, `.claude/rules/data-setup.md`, `.claude/rules/tanstack-query.md`, `.agents/skills/next-data-flow/` (`SKILL.md`, `refresh.md`, and `framework-notes.md`), and "Environment variables" in `AGENTS.md`
- **Brief:** Review the reads and writes the diff adds or changes; ESLint's data section in `eslint.config.mjs` and `lib/request/domain-error.test.ts` check the mechanical rules, so leave what they report to them. For each read, list its consumers and update triggers as the skill's Steps do, following them past the diff to every page and component that shows the same data, then check:
  - **Ownership**: one owner per read, chosen by the skill's signals; no copy of it in state, context, or a store, and no second owner refetching part of it.
  - **Server read and delivery**: a per-request read awaits a Request-time API first, `connection()` where it awaits no other; a cached read's arguments, `cacheLife`, and tags fit its freshness bound and the writes that change it; independent reads start together; each `<Suspense>` sits close to its read, with a fallback the size of the content; a value that must come from the runtime is read after one, never inside `use cache`.
  - **Refreshes**: every display of the data a write changes refreshes after it, through `updateTag` in the action for a server-cached read, `refresh()` in the action for a per-request one, and the factory's cache updates for a query; an optimistic value goes through each display's owner and rolls back on failure; data changed elsewhere and a session change each have a refresh path; a refusal that only an out-of-date page can cause refreshes that page.
  - **Failures**: the factory's `meta` sets the failure toast, and a recoverable failure suppresses it for that case only; a query renders its data first, then its error, then loading.
  - **Server Actions and the data layer**: an action validates its input before calling the data layer, which validates again; a data-layer function whose result or effect depends on who asks takes the actor as an argument and enforces the rule itself, for reads as for writes, answering 404 for a record the actor may not see and 403 for a whole view its role does not open, and each entry passes the actor it resolved from the session; a Route Handler that takes a write from another system authenticates the request as the sender's docs specify before acting on its body, handles a repeated delivery idempotently, and answers within the sender's time limit; a write that touches several rows runs in one transaction, and no transaction spans a call to another system; a broken business rule throws `DomainError` with the feature's code; results map to JSON-native schemas; a schema change follows "Schema changes" in `data-setup.md`.

## UI

- **Runs when:** the diff changes a file that the `paths` of a `.claude/rules/` file under **Standards** match, or a rendered Tailwind class in any other file.
- **Standards:** `.claude/rules/components.md`, `.claude/rules/design-system.md`, `.claude/rules/react.md`, `.claude/rules/ui-catalog.md`, and `.agents/skills/vercel-composition-patterns/` (`SKILL.md` and the `rules/` files it lists)
- **Brief:** Review each component, hook, and style the diff adds or changes, and each place it renders a project component, against every item below. ESLint's UI section in `eslint.config.mjs`, with the checks it names in other sections, checks the mechanical rules: leave its errors to it, and judge what it only warns about, such as the `jsx-a11y` checks and `react-hooks/exhaustive-deps`, since a warning fails nothing. Where a component lives, whether it has one responsibility, and whether to extract shared code are the Architecture review's.
  - **Reuse, compose, extend, or add** in `components.md`: search where its step 1 does, and confirm that the change took the least invasive action that covers the need.
  - **Use a component** in `components.md`, all of it; for each adjustment the diff passes to a component, count across the repo the callers that already make it.
  - **Write a component** in `components.md`: its step 2 and **Public API**.
  - **Design system**: all of `design-system.md`, for each wrapper and token the diff adds or changes.
  - **Styles and variants** in `components.md`, all of it, for every variant, rendered class, and motion the diff adds or changes. ESLint reads class strings only in `className` attributes, `cn()` and `cva()` calls, and variables named `className(s)`, `classes`, or `style(s)`; for a rendered class anywhere else, such as in a constant, also check what it would report.
  - **React**: all of `react.md`; in a review of a whole project, the `useMemo`, `useCallback`, and `memo` already there count as the existing ones it keeps, not as added.
  - **Accessibility** of every interactive element the diff adds or changes, as **Examples and verification** in `components.md` defines a passing scenario.
  - **UI catalog examples**: in the same change wherever **Examples and verification** in `components.md` asks for them, written as `ui-catalog.md` says.

## i18n

- **Runs when:** the diff changes `messages/`, or text, dates, or numbers that users see or hear.
- **Standards:** `.claude/rules/i18n.md` and `messages/terms.json`
- **Brief:** Review the text the diff adds, changes, or removes; ESLint checks JSX text and attributes, that each key belongs to its file's owner, the namespaces each route sends, and how moments in time render, and `messages/messages.test.ts` checks that every locale has the same keys and follows `terms.json`.
  - **Translation quality**: set each changed message in every locale beside its source-locale text and check that it says the same thing, with nothing added or dropped; reads naturally in that language rather than word for word; keeps the register and capitalization of the namespace's other messages; translates each term the way the rest of the messages do; and fits where it shows, such as on a button. Hold the source text to the same measure.
  - **Text outside JSX**: toasts, `metadata`, accessible names passed in props, labels in constants, and validation messages go through `t()`; user and backend content and developer-facing errors stay untranslated.
  - **Errors**: users see the feature's message chosen by the error's `code`, never `ApiError.message`.
  - **Removed and changed text**: the keys of removed code leave every locale, since nothing reports unused keys; changed source text is translated again in every locale.
  - **Keys**: each named after what the text means, with separate keys for the same words in different meanings.
  - **Dates and numbers**: a calendar date shown as the date it is, without a time zone; anything that depends on the time zone runs in the browser after hydration; relative times and numbers through next-intl's formatter.

## Tests

- **Runs when:** the diff changes application behavior, tests, test fixtures or helpers, or test configuration.
- **Standards:** `.claude/rules/e2e.md`, "Tests" in `.claude/rules/server-data.md`, "Test databases" in `.claude/rules/data-setup.md`, and "Test and lint tooling" in `AGENTS.md`
- **Brief:** Judge the test design: whether the tests catch this change breaking, without breaking on changes that keep its behavior. For each behavior the diff adds, changes, or fixes, find its tests, in the diff or already in the repo, then check:
  - **Missing**: a behavior no test would notice breaking is a finding, and so is a bug fix without a regression test.
  - **Level**: each behavior is tested where its failure shows, and once: a pure rule in a unit test; a data-layer rule in a `*.db.test.ts` beside its module, against the real database; what only a browser shows, such as hydration, streaming, caching, navigation, and focus, in an e2e spec.
  - **Fails for the right reason**: break the behavior in your head and find the assertion that notices. Watch for assertions that pass either way, such as on text shown elsewhere on the page, a loading state the broken version shows too, or a value the fixture already had. A regression spec fails on the commit before its fix (`pnpm e2e:at`).
  - **Outcomes, not implementation**: assertions on what users see, what callers receive, or what is stored, through the public interface; none on internal calls or private state, and no test of a mock's own behavior. In the browser, find elements by role and accessible name.
  - **Cases**: the cases that matter for the behavior, such as empty and boundary values, invalid input, a failing dependency, and concurrent writes the code guards against; one behavior per test, named by what it checks.
  - **Determinism**: nothing depends on the wall clock, randomness, test order, or a fixed wait; time and data come from fixtures, such as records a test creates for itself and the writes of a background job the fixture stands in for, and each wait ends on the event that completes it, such as `expect.poll` on a background job that runs.
  - **Stand-ins**: real dependencies where the repo provides them, such as the test databases in `data-setup.md`; a stand-in only at a boundary the tests can't run, intercepted rather than written into the app, and behaving as the real one does.
  - **Fit**: existing fixtures, helpers, and test entries reused, and setup shared rather than copied.

## Comments

- **Runs when:** the diff changes source code, comments, or test descriptions.
- **Standards:** `.claude/rules/code-comments.md` and `.claude/rules/writing-style.md`
- **Brief:** Review the comments the diff adds or changes, and the ones it leaves stale; no lint checks comments.
  - **Needed**: each added comment holds what a maintainer would miss without it (section 1); it explains why rather than what, states what holds today rather than history, and stays short. Compare the change's share of comment lines with the file's.
  - **Still true**: read the comments in each changed file and at the definition of each changed function, type, and interface, including the interface docs of code whose use changed, and report each that no longer holds (section 6).
  - **Claims about other code**: a comment about another module's behavior names it specifically, and the behavior is as it says; check it.
  - **Markers**: a TODO, FIXME, or HACK states the problem and the next step or the condition for removing it; obsolete code is deleted rather than commented out.
  - **Language**: comments and test descriptions in the prose language, with names, fixed terms, and common programming terms in English, as `writing-style.md` sets.
