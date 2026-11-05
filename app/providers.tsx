"use client";

import { useTranslations } from "next-intl";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

import { toast, Toaster } from "@/components/ui/toaster";
import { SchemaValidationError, shouldRetryRequest } from "@/lib/fetch";
import {
  environmentManager,
  type FailedRequest,
  type HandleRequestErrorOptions,
  QueryClient,
  QueryClientProvider,
} from "@/lib/react-query";

function handleRequestError(
  error: unknown,
  { suppressErrorToast, errorMessage }: HandleRequestErrorOptions,
  { id }: FailedRequest,
) {
  // schema 不匹配说明前后端契约已经不一致，调用方不弹提示时也要留下记录。
  if (error instanceof SchemaValidationError) console.error(error);
  // 服务端渲染 Client Component 时 query 也会失败到这里。sonner 把 toast 存在模块级单例里，
  // 只清理已关闭的，服务端的 toast 不会被关闭，会在进程里一直累积。
  if (environmentManager.isServer()) return;
  const suppressed =
    typeof suppressErrorToast === "function"
      ? suppressErrorToast(error)
      : suppressErrorToast;
  if (suppressed) return;
  const message =
    typeof errorMessage === "function" ? errorMessage(error) : errorMessage;
  // 按请求区分提示：同一个 query 反复失败（比如轮询）只留一个，无关的请求各自提示。
  toast.error(message ?? <RequestErrorMessage />, { id });
}

// 这个 handler 在 React 之外调用，取不到翻译；通用文案在 <Toaster /> 里渲染，那里能用 hook。
function RequestErrorMessage() {
  const t = useTranslations("app");
  return t("requestError");
}

function makeQueryClient() {
  return new QueryClient({
    onRequestError: handleRequestError,
    defaultOptions: {
      // 服务端预取的数据 hydrate 后在这段时间内不会被重新请求。
      queries: {
        staleTime: 60 * 1000,
        retry: environmentManager.isServer() ? false : shouldRetryRequest,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

// 服务端每次渲染新建，请求之间不共享缓存；浏览器始终复用同一个，首次渲染挂起时缓存也不会丢。
function getQueryClient() {
  if (environmentManager.isServer()) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

interface ProvidersProps {
  children: ReactNode;
}

/**
 * 浏览器端的 context provider 都放在这里。要在服务端读数据的 `RootClientMessages` 留在根 layout、包在外面：
 * 这是 Client Component，渲染不了 Server Component，而这里的 `RequestErrorMessage` 要用它下发的文案。
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={getQueryClient()}>
        <NuqsAdapter>{children}</NuqsAdapter>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
