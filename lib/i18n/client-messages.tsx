import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { BASE_CLIENT_NAMESPACES, type Namespace } from "./messages";

interface ClientMessagesProps {
  /**
   * 子树里的 Client Component 用到的、`BASE_CLIENT_NAMESPACES` 之外的 namespace。嵌套时内层整个替换外层的文案，
   * 所以要列全子树需要的所有 namespace，不能只写比外层多出来的。
   */
  namespaces?: readonly Namespace[];
  children: ReactNode;
}

/**
 * 给子树里的 Client Component 下发文案，只发列出的 namespace，页面不用背着全量文案。Server Component 用
 * `getTranslations` 在服务端拿得到全部文案，不受它限制。漏发的 namespace 在客户端渲染成 `namespace.key`，
 * 并打出 `MISSING_MESSAGE` 错误。
 */
export async function ClientMessages({
  namespaces = [],
  children,
}: ClientMessagesProps) {
  const messages = await getMessages();
  const picked = Object.fromEntries(
    [...BASE_CLIENT_NAMESPACES, ...namespaces].map((namespace) => [
      namespace,
      messages[namespace],
    ]),
  );
  return (
    <NextIntlClientProvider messages={picked}>
      {children}
    </NextIntlClientProvider>
  );
}
