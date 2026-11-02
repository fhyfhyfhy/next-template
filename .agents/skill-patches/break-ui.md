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
