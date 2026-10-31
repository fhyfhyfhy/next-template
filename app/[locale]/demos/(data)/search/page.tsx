import type { Metadata } from "next";
import { Suspense } from "react";

import { PageIntro, TaskSearch } from "@/features/demo-task";

export const metadata: Metadata = { title: "搜索 · Data demo" };

export default function SearchPage() {
  return (
    <>
      <PageIntro title="搜索">
        <p>
          边输入边请求，数据由 React Query
          负责：每次按键都走一遍服务端渲染会明显滞后。输入停顿 300ms
          后关键词写进 URL，但只是 shallow
          更新，不触发导航、不新增历史记录，刷新或分享链接时能还原。
        </p>
        <p>
          试试：快速改关键词，旧关键词的请求会被中止；新结果返回前列表保留上一次的结果。
        </p>
      </PageIntro>
      {/* useSearchParams 在预渲染时没有值，放进 Suspense 让它在请求时渲染。 */}
      <Suspense fallback={null}>
        <TaskSearch />
      </Suspense>
    </>
  );
}
