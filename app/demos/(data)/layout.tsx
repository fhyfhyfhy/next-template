import { type ReactNode, Suspense } from "react";

import { DataDemoHeader, MockApiNotice } from "@/features/demo-task";

/**
 * Data demo 各页面的外壳。只在 run-next.mjs 启动了 Mock API 时（注入 NEXT_PUBLIC_MOCK_API=1）渲染页面，
 * 否则只显示说明、不发请求：项目配置了真实后端后，demo 的请求不能落到真实后端上。
 */
export default function DataDemoLayout({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_MOCK_API !== "1") return <MockApiNotice />;
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
