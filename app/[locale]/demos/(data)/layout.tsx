import { connection } from "next/server";
import { type ReactNode, Suspense } from "react";

import {
  activeTasksQueryOptions,
  DataDemoHeader,
  DemoBackendNotice,
  RunningTasksBadge,
  RunningTasksBadgeSkeleton,
  taskFiltersOf,
} from "@/features/demo-task";
import { listTasks } from "@/features/demo-task/server";
import { isDemoBackendEnabled } from "@/lib/demo-backend";
import { ClientMessages } from "@/lib/i18n/client-messages";
import {
  dehydrate,
  HydrationBoundary,
  noop,
  QueryClient,
} from "@/lib/react-query";

/** Data demo 各页面的外壳。Demo backend 没有启用时只显示说明，页面本身不渲染、不读写数据。 */
export default function DataDemoLayout({ children }: { children: ReactNode }) {
  return (
    <ClientMessages namespaces={["demo-task"]}>
      {isDemoBackendEnabled() ? (
        <>
          {/* 导航读当前路径，放进 Suspense 才不影响动态路由的预渲染。 */}
          <Suspense
            fallback={
              <div className="h-16.25 border-b border-border bg-card" />
            }
          >
            <DataDemoHeader
              badge={
                <Suspense fallback={<RunningTasksBadgeSkeleton />}>
                  <RunningTasksHydration />
                </Suspense>
              }
            />
          </Suspense>
          <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
            {children}
          </main>
        </>
      ) : (
        <DemoBackendNotice />
      )}
    </ClientMessages>
  );
}

/**
 * 进行中任务数是按请求读的数据：服务端预取后随页面送达，徽标不用等浏览器再请求一轮。
 * 每个 Data demo 页面因此多一次数据层读取，它在自己的 Suspense 里，不挡导航进静态 shell。
 */
async function RunningTasksHydration() {
  await connection();
  const queryClient = new QueryClient();
  // 读取失败时徽标在浏览器里重新请求，并显示自己的错误状态。
  const activeTasks = activeTasksQueryOptions();
  await queryClient
    .query({
      ...activeTasks,
      queryFn: () => listTasks(taskFiltersOf(activeTasks)),
    })
    .catch(noop);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RunningTasksBadge />
    </HydrationBoundary>
  );
}
