import { demoRoute, retryTaskRecord } from "@/features/demo-task/server";

/** 模拟别的客户端重试任务：和页面上的重试走同一个数据层函数，但不让 Next 的缓存失效。 */
export const POST = demoRoute(
  async (
    _request,
    { params }: RouteContext<"/api/demo/control/tasks/[id]/retry">,
  ) => retryTaskRecord((await params).id),
);
