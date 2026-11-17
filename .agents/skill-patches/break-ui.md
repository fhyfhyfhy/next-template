# break-ui

Upstream: `skills/break-ui/` in `emilkowalski/skills`, as `npx skills update` installs it.

## Numbers come from next-intl's formatter

`.claude/rules/i18n.md` ("Dates and numbers") formats numbers with next-intl's `useFormatter` or `getFormatter`, which carry the page's locale, never a separate `Intl` formatter.

```diff
@@ #### Failure signatures @@
 | Numbers jitter when they update, columns misalign | Proportional figures | `font-variant-numeric: tabular-nums` |
-| `1284`, `1,284.000000001`, `NaN`, `undefined` | Raw number rendered | `Intl.NumberFormat` with the user's locale; guard null |
+| `1284`, `1,284.000000001`, `NaN`, `undefined` | Raw number rendered | next-intl's `useFormatter` or `getFormatter` (`.claude/rules/i18n.md`); guard null |
 | Long translated button label overflows | Fixed-width button | Width from content with `min-width`, never a fixed `width` |
```

## Plurals are ICU messages

`.claude/rules/i18n.md` writes plurals in ICU syntax inside the message and passes the count to `t()`, so every locale gets its own plural forms from its translation.

```diff
@@ #### Failure signatures @@
 | Orphaned `—` or empty line where the role was | Placeholder rendered for a missing optional field | Omit the line, or reserve its height intentionally |
-| "1 members", "0 member" | Hardcoded plural | `Intl.PluralRules`, or separate strings per count |
+| "1 members", "0 member" | Hardcoded plural | An ICU plural in the message, such as `{count, plural, one {# member} other {# members}}`, rendered with `t()` (`.claude/rules/i18n.md`) |
 | Numbers jitter when they update, columns misalign | Proportional figures | `font-variant-numeric: tabular-nums` |
```

```diff
@@ ### Part 1 — What broke @@
 | 2 | Ugly | avatar | name with long email | Avatar squishes to a 28×56 pill | `flex-shrink: 0` on avatar |
-| 3 | Ugly | `count` | 1 | "1 members" | `Intl.PluralRules` |
+| 3 | Ugly | `count` | 1 | "1 members" | ICU plural in the message |
 | 4 | Fragile | `name` | — | No max length in schema or form | Add a limit in both, matching |
```

## Dates and times go through `<DateTime>`

`.claude/rules/i18n.md` ("Dates and numbers") shows a date or time only through `<DateTime>` from `@/components/date-time`, which renders it in the computer's time zone once the page has hydrated, and ESLint reports `Intl.DateTimeFormat`, `toLocale*String()`, `toDateString()`, and `toTimeString()` anywhere else. Relative times use next-intl's formatter.

File: CATALOG.md

```diff
@@ ## Time @@
 | Very long duration (`1,284 hours`) | Duration formatting that never rolls up to days |
 
-Use `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat`, not hand-built strings.
+Show dates and times with `<DateTime>` from `@/components/date-time`, and relative times with next-intl's `useFormatter` or `getFormatter`, not hand-built strings (`.claude/rules/i18n.md`, "Dates and numbers").
 
 ## Images and media
```

## No canned first reply

An agent that invokes the skill mid-task needs the worst case and the report, not a greeting that waits for a question.

```diff
@@ ## Initial Response @@
 # Breaking UI
 
-## Initial Response
-
-When this skill is first invoked without a specific question, respond only with:
-
-> I'm ready to throw the worst realistic data at your UI and show you what breaks, my standards come from Emil Kowalski's design engineering philosophy.
-
-Do not provide any other information until the user asks a question.
-
 An adversarial skill. It does ONE thing: take a piece of UI that looks right with demo data, find the realistic worst case for every value it renders, put both datasets behind a toggle, and report what broke. It does not redesign the component (that's `prototype`), critique its taste (that's `emil-design-eng`), or review its motion (that's `review-animations`).
```

## The worst case goes where the repo keeps examples and local data

Pages here read the database, so a toggle in `app/` or `features/` is a data stand-in built into the app, and it would have to pass the lint on native elements, palette colors, and literal copy. The components in `components/ui/` already have a UI catalog that shows each of their states, and the local database holds whatever records a page needs.

```diff
@@ frontmatter @@
 name: break-ui
-description: Try to break a piece of UI by feeding it worst-case data — long names, unbreakable emails, one-letter names, missing fields, huge counts, zero items, long labels, non-Latin text, emoji, extreme numbers — then render it behind a "Demo data / Worst case" toggle and report everything that broke, with the fix for each. Use when the user asks to stress-test, break, or find edge cases in a component or screen, or to "try the worst case". For visual design critique use emil-design-eng; for motion use review-animations.
+description: Try to break a piece of UI by feeding it worst-case data — long names, unbreakable emails, one-letter names, missing fields, huge counts, zero items, long labels, non-Latin text, emoji, extreme numbers — then render it where the demo data lives and report everything that broke, with the fix for each. Use when the user asks to stress-test, break, or find edge cases in a component or screen, or to "try the worst case". For visual design critique use emil-design-eng; for motion use review-animations.
 ---
@@ # Breaking UI @@
-An adversarial skill. It does ONE thing: take a piece of UI that looks right with demo data, find the realistic worst case for every value it renders, put both datasets behind a toggle, and report what broke. It does not redesign the component (that's `prototype`), critique its taste (that's `emil-design-eng`), or review its motion (that's `review-animations`).
+An adversarial skill. It does ONE thing: take a piece of UI that looks right with demo data, find the realistic worst case for every value it renders, render it where the demo data lives, and report what broke. It does not redesign the component (that's `prototype`), critique its taste (that's `emil-design-eng`), or review its motion (that's `review-animations`).
 
 ## Operating Posture
@@ ## Hard Rules @@
 3. **One dataset, many failures.** A single worst-case dataset should hit every row of the catalog that applies to this component at once. Mix them across rows (row 1 is the long name, row 2 is the long email, row 3 is the one-letter name), as real data does.
-4. **The toggle is dev-only.** It never ships to production. Gate it behind the dev environment or keep it inside a prototype route.
+4. **No data switch in app code.** The worst case is a UI catalog example or records in the local database (Phase 3), never a branch in `app/` or `features/` that picks a fixture.
 5. **Report before fixing.** Some breaks are design decisions (truncate or wrap? hide the role or show "—"?). List them all, propose a fix for each, then stop. Fix only when asked.
@@ ### Phase 3 — Wire the toggle @@
 - **Huge**: the realistic upper bound for list length (1,000+ rows if the list is unpaginated, since that's a performance break as well as a visual one).
 
-These can be extra toggle positions or extra fixtures. Don't skip them because they don't fit the two-state toggle.
+These are extra examples or extra records (Phase 3). Don't skip them because they don't fit the one worst-case dataset.
 
-### Phase 3 — Wire the toggle
+### Phase 3 — Place the worst case
 
-Put a segmented control labeled **Demo data / Worst case** where the user can flip it while looking at the component, and swap the fixture at the data boundary (Hard Rule 2). Extra states go in as extra segments: **Demo / Worst case / Empty / One / 1,000 rows**.
-
-- **In a project with a dev server**: a dev-only switch (a `?data=worst` URL param read where the fixture is chosen, or a prototype route that renders the component with each fixture). The selection persists in the URL so a reload keeps it.
-- **No project / standalone component**: a single self-contained HTML file with the component and both datasets inline.
-
-Fixed at the bottom-center of the viewport, out of the component's way. Small, neutral, obviously chrome. It is not part of the design under test, so keep it plain: a gray track, a white pill on the active segment, system font. Switching is instant, with no animation on the content.
+This repo needs no toggle. Put the worst case where the demo data already is (Hard Rule 2):
+
+- **A component in `components/ui/`**: one `*.example.tsx` per state in `features/ui-catalog/components/<component-id>-examples/` (`.claude/rules/ui-catalog.md`), as `long-labels.example.tsx` in `features/ui-catalog/components/select-examples/` is. The UI catalog page `/ui?component=<component-id>` then shows the demo examples and the worst case together.
+- **A feature component or a page**: create the records in the local `dev` dataset, through the app's own UI or SQL; `pnpm db:reset` brings back the seed data. Empty, one, and 1,000 rows are states of that data too.
 
 ### Phase 4 — Break it
@@ ### Phase 5 — Report and stop @@
 ### Phase 5 — Report and stop
 
-Present the findings in the format below, leave the toggle running, and stop. The user flips the toggle, looks, and decides.
+Present the findings in the format below and stop. The user opens the worst case, looks, and decides.
 
 ### Phase 6 — Fix on request
@@ ### Phase 6 — Fix on request @@
 
-When the user says which to fix, apply those fixes in the component, using the project's existing conventions and tokens. Then flip the toggle through every state again (Demo too: a fix for the worst case must not regress the demo) and confirm each fixed break is gone.
+When the user says which to fix, apply those fixes in the component, using the project's existing conventions and tokens. Then view every state again (the demo data too: a fix for the worst case must not regress the demo) and confirm each fixed break is gone.
 
-Keep the worst-case fixture afterward unless the user says otherwise. It's the regression test for the next time someone touches the component. The toggle stays dev-only either way.
+Keep the worst-case UI catalog examples afterward unless the user says otherwise. They're the regression test for the next time someone touches the component. Records made in the local database stay local.
 
 ## Required Output Format
@@ ### Part 3 — What held up @@
 
-Close with where the toggle is (URL or file path), the states it has, and: "Say `fix all` or `fix 1, 3` and I'll apply them."
+Close with where the worst case is (the `/ui?component=<component-id>` URL, or the records you made and the page that shows them), the states it covers, and: "Say `fix all` or `fix 1, 3` and I'll apply them."
 
 ## Invocation Variants
@@ ## Invocation Variants @@
 | --- | --- |
-| `<component or screen>` | Full workflow: map → worst case → toggle → break → report, then stop |
+| `<component or screen>` | Full workflow: map → worst case → place it → break → report, then stop |
 | `<component> + fix` | Same, then apply every fix that isn't in "Decisions for you" |
 | `fix all` / `fix 1, 3` | Apply the named fixes from the last report, re-verify all states |
-| `data only <component>` | Produce the worst-case fixture and toggle without the report |
+| `data only <component>` | Produce the worst-case examples or records without the report |
 
 ## Tone
```
