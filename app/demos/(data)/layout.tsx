import { type ReactNode, Suspense } from "react";

import {
  DataDemoHeader,
  MOCK_API_RUNNING,
  MockApiNotice,
} from "@/features/demo-task";

/** Data demo 各页面的外壳。Mock API 没有运行时只显示说明，页面本身不渲染、不发请求。 */
export default function DataDemoLayout({ children }: { children: ReactNode }) {
  if (!MOCK_API_RUNNING) return <MockApiNotice />;
  return (
    <>
      {/* 导航读当前路径、徽标创建 query 时读当前时间，放进 Suspense 才不影响静态 shell 的预渲染。 */}
      <Suspense
        fallback={<div className="h-[65px] border-b border-border bg-card" />}
      >
        <DataDemoHeader />
      </Suspense>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">{children}</main>
    </>
  );
}
