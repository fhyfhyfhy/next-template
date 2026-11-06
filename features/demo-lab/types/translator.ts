import type { useTranslations } from "next-intl";

/**
 * `demo-lab` namespace 的 `t`：组件里来自 `useTranslations("demo-lab")`。写操作的 options factory 用它
 * 生成失败提示。
 */
export type DemoLabTranslator = ReturnType<typeof useTranslations<"demo-lab">>;
