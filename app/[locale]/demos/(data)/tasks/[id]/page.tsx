import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  DemoNote,
  getCommentsQueryOptions,
  getTaskQueryOptions,
  TaskDetail,
  TaskDetailSkeleton,
} from "@/features/demo-task";
import {
  getTask,
  isDemoBackendEnabled,
  isTaskMissing,
  listComments,
  omitFunctionMeta,
} from "@/features/demo-task/server";
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
  const t = await getTranslations("app.demos.taskDetail");
  if (!isDemoBackendEnabled()) return { title: t("demoBackendOffTitle") };
  const { id } = await params;
  // 和页面里的 prefetch 读的是同一个数据层函数，它用 React cache() 包过，一次渲染内只查一次库。connection()
  // 让读取只发生在真正响应请求的那次渲染里，原因见下面的 TaskDetailHydration。
  await connection();
  const task = await getTask(id).catch((error: unknown) => {
    if (isTaskMissing(error)) return null;
    throw error;
  });
  return {
    title: t("metadataTitle", { name: task?.name ?? t("notFound.title") }),
  };
}

// page 保持同步，只在 Suspense 里读 params：骨架屏进静态 shell，导航时立即显示。代价是不存在的任务
// 拿不到 404 状态码：shell 先以 200 发出，notFound() 之后流式送达 not-found 页面并加上 noindex。
export default function TaskDetailPage({
  params,
}: PageProps<"/[locale]/demos/tasks/[id]">) {
  const t = useTranslations("app.demos.taskDetail.note");
  return (
    <>
      <DemoNote>
        <p>{t("ownership")}</p>
        <p>{t("tryIt")}</p>
      </DemoNote>
      <Suspense fallback={<TaskDetailSkeleton />}>
        {params.then(({ id }) => (
          <TaskDetailHydration id={id} />
        ))}
      </Suspense>
    </>
  );
}

/**
 * 服务端 prefetch：展开浏览器用的 options factory（key、轮询、错误策略都来自它），只把 `queryFn` 换成数据层函数。
 * 服务端不请求自己的 Route Handler；两边得到的数据结构相同（features/demo-task/types/task.ts）。
 */
async function TaskDetailHydration({ id }: { id: string }) {
  if (!isDemoBackendEnabled()) return null;
  // 详情是按请求读的数据。请求到达时 Next 会先做一次预备渲染再做最终渲染，React cache() 只在一次渲染内去重；
  // 不先等 connection()，预备渲染也会查库，同一个请求就查两次（e2e 断言服务端只读一次）。
  await connection();
  const queryClient = new QueryClient();
  try {
    await queryClient.query({
      ...getTaskQueryOptions(id),
      queryFn: () => getTask(id),
    });
  } catch (error) {
    if (isTaskMissing(error)) notFound();
    throw error;
  }
  // 评论不阻塞首屏：不 await，以 pending 状态 dehydrate，数据到了再流式送到浏览器。
  void queryClient
    .query({ ...getCommentsQueryOptions(id), queryFn: () => listComments(id) })
    .catch(noop);
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
