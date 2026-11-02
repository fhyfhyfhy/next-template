import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { MergeMessages } from "./merge-messages";
import type { Namespace } from "./messages";

interface ClientMessagesProps {
  /**
   * The namespaces this level adds. Those already sent from outside are merged in, so don't list
   * them again. ESLint's `i18n/client-namespaces` checks this list against the namespaces the
   * subtree's Client Components actually use, and `--fix` rewrites it.
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
 * The outermost message provider, in a root layout; it also gives Client Components the locale, time
 * zone and formatting config. Use it once in each root layout; the `ClientMessages` inside it merge
 * with it.
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
 * Adds namespaces for the Client Components in its subtree, so a page doesn't carry every message.
 * Use it only in a layout, template or page, inside a `RootClientMessages`. Server Components get
 * every message on the server through `getTranslations` and are not limited by it; a namespace left
 * unsent renders as `namespace.key` on the client and logs a `MISSING_MESSAGE` error.
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
