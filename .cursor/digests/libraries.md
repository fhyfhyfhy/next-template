---
source: .claude/rules/libraries.md
source-sha256: c825860c998fa7603a9d81eaf486c4661f6a9e63f5e6cf9aafd30e11364bd438
---

- One library per need: UI primitives `@base-ui/react`, toasts `sonner`, OTP `input-otp`, icons `@tabler/icons-react`, forms `@tanstack/react-form` with `Field` from `components/ui/field/`, charts `@tanstack/react-charts`, i18n `next-intl`, URL state `nuqs`, IDs `nanoid`.
- Relative times and numbers use next-intl's `useFormatter`/`getFormatter`; date math uses native `Date`, `dayjs` only past it.
- Generic hooks: `@mantine/hooks`; `hooks/` adds only what it lacks.
