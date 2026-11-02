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

`.claude/rules/i18n.md` ("Dates and numbers") shows a date or time only through `<DateTime>` from `@/components/date-time`, which renders it in the computer's time zone once the page has hydrated, and ESLint reports `Intl.DateTimeFormat` anywhere else. Relative times use next-intl's formatter.

File: CATALOG.md

```diff
@@ ## Time @@
 | Very long duration (`1,284 hours`) | Duration formatting that never rolls up to days |
 
-Use `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat`, not hand-built strings.
+Show dates and times with `<DateTime>` from `@/components/date-time`, and relative times with next-intl's `useFormatter` or `getFormatter`, not hand-built strings (`.claude/rules/i18n.md`, "Dates and numbers").
 
 ## Images and media
```
