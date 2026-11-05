import { type ReactNode, Suspense } from "react";

import { DataDemoHeader, DemoBackendNotice } from "@/features/demo-task";
import { isDemoBackendEnabled } from "@/features/demo-task/server";
import { ClientMessages } from "@/lib/i18n/client-messages";

/** Data demo 各页面的外壳。Demo backend 没有启用时只显示说明，页面本身不渲染、不读写数据。 */
export default function DataDemoLayout({ children }: { children: ReactNode }) {
  return (
    <ClientMessages namespaces={["demo-task"]}>
      {isDemoBackendEnabled() ? (
        <>
          {/* 导航读当前路径、徽标创建 query 时读当前时间，放进 Suspense 才不影响静态 shell 的预渲染。 */}
          <Suspense
            fallback={
              <div className="h-16.25 border-b border-border bg-card" />
            }
          >
            <DataDemoHeader />
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
