"use client";

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
  // schema 不匹配说明前后端契约已经不一致，调用方不弹提示时也要留下记录。
  if (error instanceof SchemaValidationError) console.error(error);
  // 服务端渲染 Client Component 时 query 也会失败到这里。sonner 把 toast 存在模块级单例里，
  // 只清理已关闭的，服务端的 toast 不会被关闭，会在进程里一直累积。
  if (environmentManager.isServer()) return;
  const suppressed =
    typeof suppressErrorToast === "function"
      ? suppressErrorToast(error)
      : suppressErrorToast;
  if (!suppressed) toast.error("请求失败，请稍后重试");
}

function makeQueryClient() {
  return new QueryClient({
    onRequestError: handleRequestError,
    defaultOptions: {
      // 服务端预取的数据 hydrate 后在这段时间内不会被重新请求。
      queries: { staleTime: 60 * 1000, retry: shouldRetryRequest },
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

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
