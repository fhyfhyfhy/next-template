import type { useTranslations } from "next-intl";

/**
 * 读文案的 `t`：组件里来自 `useTranslations()`，服务端来自 `getTranslations()`，两者类型相同。key 写完整路径，
 * 第一段是读它的文件的 owner 的 namespace（.claude/rules/i18n.md）。options 工厂、schema 工厂这类函数接收它。
 */
export type Translator = ReturnType<typeof useTranslations<never>>;
