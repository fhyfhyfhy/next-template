import { advanceTask, demoRoute } from "@/features/demo-task/server";

/** 把任务推进一步，时钟暂停时也推进；返回推进后的任务。 */
export const POST = demoRoute(
  async (
    _request,
    { params }: RouteContext<"/api/demo/control/tasks/[id]/advance">,
  ) => advanceTask((await params).id),
);
