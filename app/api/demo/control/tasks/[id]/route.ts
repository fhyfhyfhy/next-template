import { deleteTaskRecord, demoRoute } from "@/features/demo-task/server";

/** 模拟别的客户端删除任务：和页面上的删除走同一个数据层函数，但不让 Next 的缓存失效。 */
export const DELETE = demoRoute(
  async (
    _request,
    { params }: RouteContext<"/api/demo/control/tasks/[id]">,
  ) => {
    await deleteTaskRecord((await params).id);
    return new Response(null, { status: 204 });
  },
);
