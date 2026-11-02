import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { MergeMessages } from "./merge-messages";
import type { Namespace } from "./messages";

interface ClientMessagesProps {
  /**
   * 这一层新增下发的 namespace。外层已经下发的会合并进来，不用再列。ESLint 的
   * `i18n/client-namespaces` 按子树里 Client Component 实际用到的 namespace 检查这个列表，`--fix` 会改写它。
   */
  namespaces: readonly Namespace[];
  children: ReactNode;
}

async function pickMessages(namespaces: readonly Namespace[]) {
  const messages = await getMessages();
  return Object.fromEntries(
    namespaces.map((namespace) => [namespace, messages[namespace]]),
  );
}

/**
 * 根 layout 里最外层的文案下发：同时给 Client Component 提供 locale、时区和格式化配置。
 * 每个根 layout 用一次，里面的 `ClientMessages` 和它合并。
 */
export async function RootClientMessages({
  namespaces,
  children,
}: ClientMessagesProps) {
  return (
    <NextIntlClientProvider messages={await pickMessages(namespaces)}>
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * 给子树里的 Client Component 追加 namespace，页面不用背着全量文案。只能放在 layout、template、page 里，
 * 外面要有 `RootClientMessages`。Server Component 用 `getTranslations` 在服务端拿得到全部文案，不受它限制；
 * 漏发的 namespace 在客户端渲染成 `namespace.key`，并打出 `MISSING_MESSAGE` 错误。
 */
export async function ClientMessages({
  namespaces,
  children,
}: ClientMessagesProps) {
  return (
    <MergeMessages messages={await pickMessages(namespaces)}>
      {children}
    </MergeMessages>
  );
}
