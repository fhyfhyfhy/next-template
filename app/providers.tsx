"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { toast, Toaster } from "@/components/ui/toaster";
import { SchemaValidationError, shouldRetryRequest } from "@/lib/fetch";
import {
  environmentManager,
  type HandleRequestErrorOptions,
  QueryClient,
  QueryClientProvider,
} from "@/lib/react-query";

function handleRequestError(
  error: unknown,
  { suppressErrorToast }: HandleRequestErrorOptions,
) {
  // A schema mismatch means the frontend and backend contracts have diverged:
  // log it even when the caller suppresses the toast.
  if (error instanceof SchemaValidationError) console.error(error);
  // Queries also fail here while the server renders Client Components. sonner
  // keeps toasts in a module-level singleton and removes only dismissed ones; a
  // toast on the server is never dismissed, so they would pile up for the life
  // of the process.
  if (environmentManager.isServer()) return;
  const suppressed =
    typeof suppressErrorToast === "function"
      ? suppressErrorToast(error)
      : suppressErrorToast;
  if (!suppressed) {
    toast.error(<RequestErrorMessage />, { id: "request-error" });
  }
}

// The handler runs outside React and can't get translations; the toast's
// content renders inside <Toaster />, where hooks work.
function RequestErrorMessage() {
  const t = useTranslations("app");
  return t("requestError");
}

function makeQueryClient() {
  return new QueryClient({
    onRequestError: handleRequestError,
    defaultOptions: {
      // Data prefetched on the server isn't refetched for this long after
      // hydration.
      queries: {
        staleTime: 60 * 1000,
        retry: environmentManager.isServer() ? false : shouldRetryRequest,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

// A new client for each server render, so requests share no cache. The browser
// always reuses one, so the cache survives a suspended first render.
function getQueryClient() {
  if (environmentManager.isServer()) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
