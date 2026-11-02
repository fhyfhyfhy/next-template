import type { AbstractIntlMessages } from "next-intl";

import type app from "@/messages/zh/app.json";
import type demoTask from "@/messages/zh/demo-task.json";
import type demoUi from "@/messages/zh/demo-ui.json";
import type ui from "@/messages/zh/ui.json";

import type { Locale } from "./routing";

/**
 * 全部文案，类型取自 Source locale 的文件。每个 namespace 对应 `messages/{locale}/{namespace}.json`，
 * 按 owner 命名：feature 用目录名，`app/` 用 `app`，`components/` 用 `ui`（.claude/rules/i18n.md）。
 */
export interface Messages {
  app: typeof app;
  ui: typeof ui;
  "demo-task": typeof demoTask;
  "demo-ui": typeof demoUi;
}

export type Namespace = keyof Messages;

/** 加载顺序无关紧要；`messages/messages.test.ts` 检查它和 `messages/` 下的文件一一对应。 */
export const NAMESPACES = [
  "app",
  "ui",
  "demo-task",
  "demo-ui",
] as const satisfies readonly Namespace[];

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}

/** 文件里没有 namespace 这一层，加载时按文件名包上，文件名和 namespace 不会对不上。 */
export async function loadMessages(
  locale: Locale,
): Promise<AbstractIntlMessages> {
  const entries = await Promise.all(
    NAMESPACES.map(async (namespace) => {
      // 模板路径要用相对路径：打包器按它收集 messages/ 下所有匹配的文件。
      const file = await import(`../../messages/${locale}/${namespace}.json`);
      return [namespace, file.default] as const;
    }),
  );
  return Object.fromEntries(entries);
}
