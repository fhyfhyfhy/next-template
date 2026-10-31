import type { Metadata } from "next";
import { Suspense } from "react";

import { PageIntro, RecentTasks } from "@/features/demo-task";

export const metadata: Metadata = { title: "最近查看 · Data demo" };

export default function RecentPage() {
  return (
    <>
      <PageIntro title="最近查看">
        <p>
          打开过的任务详情记在这个浏览器的 localStorage 里。服务端读不到
          localStorage，所以列表只能在浏览器里请求，等 hydration
          完成、读到记录之后，每个任务发一个请求。
        </p>
      </PageIntro>
      <Suspense fallback={null}>
        <RecentTasks />
      </Suspense>
    </>
  );
}
