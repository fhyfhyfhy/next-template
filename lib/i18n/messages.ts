import type { AbstractIntlMessages } from "next-intl";

import type app from "@/messages/zh/app.json";
import type demoTask from "@/messages/zh/demo-task.json";
import type demoUi from "@/messages/zh/demo-ui.json";
import type ui from "@/messages/zh/ui.json";

import type { Locale } from "./routing";

/**
 * Every message, typed from the source locale's files. Each namespace is
 * `messages/{locale}/{namespace}.json`, named after its owner: a feature's directory name, `app` for
 * `app/`, `ui` for `components/` (.claude/rules/i18n.md).
 */
export interface Messages {
  app: typeof app;
  ui: typeof ui;
  "demo-task": typeof demoTask;
  "demo-ui": typeof demoUi;
}

export type Namespace = keyof Messages;

/** The order does not matter; `messages/messages.test.ts` checks that it matches the files under `messages/` one to one. */
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

/** The files have no namespace level: loading wraps each in its file name, so a file name and its namespace cannot disagree. */
export async function loadMessages(
  locale: Locale,
): Promise<AbstractIntlMessages> {
  const entries = await Promise.all(
    NAMESPACES.map(async (namespace) => {
      // The template literal must be a relative path: the bundler collects every matching file under messages/ from it.
      const file = await import(`../../messages/${locale}/${namespace}.json`);
      return [namespace, file.default] as const;
    }),
  );
  return Object.fromEntries(entries);
}
