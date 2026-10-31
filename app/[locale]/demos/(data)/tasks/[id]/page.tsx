import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  DemoNote,
  getCommentsQueryOptions,
  getTaskQueryOptions,
  isTaskNotFound,
  MOCK_API_RUNNING,
  TaskDetail,
  TaskDetailSkeleton,
} from "@/features/demo-task";
import { getTask, omitFunctionMeta } from "@/features/demo-task/server";
import {
  defaultShouldDehydrateQuery,
  dehydrate,
  HydrationBoundary,
  noop,
  QueryClient,
} from "@/lib/react-query";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/demos/tasks/[id]">): Promise<Metadata> {
  if (!MOCK_API_RUNNING) return { title: "Data demo" };
  const { id } = await params;
  // 和页面里的 prefetch 是同一个 GET，一次渲染内只请求一次（fetchApi 不传 signal 时参与去重）。
  const task = await getTask(id).catch((error: unknown) => {
    if (isTaskNotFound(error)) return null;
    throw error;
  });
  return { title: `${task?.name ?? "任务不存在"} · Data demo` };
}

// page 保持同步，只在 Suspense 里读 params：骨架屏进静态 shell，导航时立即显示。代价是不存在的任务
// 拿不到 404 状态码：shell 先以 200 发出，notFound() 之后流式送达 not-found 页面并加上 noindex。
export default function TaskDetailPage({
  params,
}: PageProps<"/[locale]/demos/tasks/[id]">) {
  return (
    <>
      <DemoNote>
        <p>
          详情由 React Query
          负责：任务在你停留时会自己推进，排队中和生成中的任务每 1.5
          秒轮询一次，到终态后停止，并刷新 header
          的进行中任务数。首屏数据由服务端 prefetch，评论随后流式送达。
        </p>
        <p>
          试试：重试一个失败的任务；把它重命名成已存在的名称；换一张封面图后回到列表；在评论区发表和删除评论。
        </p>
      </DemoNote>
      <Suspense fallback={<TaskDetailSkeleton />}>
        {params.then(({ id }) => (
          <TaskDetailHydration id={id} />
        ))}
      </Suspense>
    </>
  );
}

async function TaskDetailHydration({ id }: { id: string }) {
  if (!MOCK_API_RUNNING) return null;
  const queryClient = new QueryClient();
  try {
    await queryClient.query(getTaskQueryOptions(id));
  } catch (error) {
    if (isTaskNotFound(error)) notFound();
    throw error;
  }
  // 评论不阻塞首屏：不 await，以 pending 状态 dehydrate，数据到了再流式送到浏览器。
  void queryClient.query(getCommentsQueryOptions(id)).catch(noop);
  const state = dehydrate(queryClient, {
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) || query.state.status === "pending",
  });
  return (
    <HydrationBoundary state={omitFunctionMeta(state)}>
      <TaskDetail taskId={id} />
    </HydrationBoundary>
  );
}
