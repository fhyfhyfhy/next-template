import type { useTranslations } from "next-intl";

/**
 * `demo-faults` namespace 的 `t`：组件里来自 `useTranslations("demo-faults")`。写操作的 options factory 用它
 * 生成失败提示。
 */
export type DemoFaultsTranslator = ReturnType<
  typeof useTranslations<"demo-faults">
>;
