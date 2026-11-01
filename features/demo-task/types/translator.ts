import type { useTranslations } from "next-intl";

/**
 * The `t` of the `demo-task` namespace: from `useTranslations("demo-task")` in
 * components and from `getTranslations({ locale, namespace: "demo-task" })` in
 * Server Actions; both have the same type. The validation schema factories
 * build their messages with it.
 */
export type DemoTaskTranslator = ReturnType<
  typeof useTranslations<"demo-task">
>;
