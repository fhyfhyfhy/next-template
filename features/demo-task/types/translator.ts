import type { useTranslations } from "next-intl";

/**
 * `demo-task` namespace 的 `t`：组件里来自 `useTranslations("demo-task")`，Server Action 里来自
 * `getTranslations({ locale, namespace: "demo-task" })`，两者类型相同。校验 schema 的工厂用它生成文案。
 */
export type DemoTaskTranslator = ReturnType<
  typeof useTranslations<"demo-task">
>;
