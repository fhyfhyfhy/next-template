"use client";

import {
  type AbstractIntlMessages,
  NextIntlClientProvider,
  useLocale,
  useMessages,
} from "next-intl";
import { type ReactNode, useMemo } from "react";

interface MergeMessagesProps {
  messages: AbstractIntlMessages;
  children: ReactNode;
}

/**
 * `ClientMessages` 的客户端部分。next-intl 嵌套的 provider 传了 `messages` 就整个替换外层的，这里先把外层的
 * 合并进来；时区、now、formats 由 provider 从外层继承，只有 `locale` 要显式传。
 */
export function MergeMessages({ messages, children }: MergeMessagesProps) {
  const outer = useMessages();
  const locale = useLocale();
  const merged = useMemo(() => ({ ...outer, ...messages }), [outer, messages]);
  return (
    <NextIntlClientProvider locale={locale} messages={merged}>
      {children}
    </NextIntlClientProvider>
  );
}
