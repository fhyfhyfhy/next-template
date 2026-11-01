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
 * The client part of `ClientMessages`. A nested next-intl provider given `messages` replaces the
 * outer messages entirely, so this merges the outer ones in first; the provider inherits the time
 * zone, now and formats from the outer one, and only `locale` must be passed explicitly.
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
