import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getCommentsQueryOptions,
  getTaskQueryOptions,
  isTaskNotFound,
  TaskDetail,
} from "@/features/demo-task";
import { getTask, omitFunctionMeta } from "@/features/demo-task/server";
import {
  defaultShouldDehydrateQuery,
  dehydrate,
  HydrationBoundary,
  noop,
  QueryClient,
} from "@/lib/react-query";

// 不存在的任务要返回 404 状态码：notFound() 必须在响应开始流式输出之前调用。静态 shell 或 Suspense 的
// fallback 一旦发出，状态码就固定成 200，所以这个页面不生成静态 shell，在顶层等到任务确认存在后才输出。
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/demos/tasks/[id]">): Promise<Metadata> {
  const { id } = await params;
  // 和页面里的 prefetch 是同一个 GET，一次渲染内只请求一次（fetchApi 不传 signal 时参与去重）。
  const task = await getTask(id).catch((error: unknown) => {
    if (isTaskNotFound(error)) return null;
    throw error;
  });
  return { title: `${task?.name ?? "任务不存在"} · Data demo` };
}

export default async function TaskDetailPage({
  params,
}: PageProps<"/demos/tasks/[id]">) {
  const { id } = await params;
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
