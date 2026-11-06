import { demoRoute } from "@/features/demo-faults/server";
import { getTaskModelUrl } from "@/features/demo-task/server";

/** done 任务的模型：302 到对象存储的短期下载地址，文件不经过 Next；没完成时返回 409 和 TASK_NOT_DONE。 */
export const GET = demoRoute(
  async (_request, { params }: RouteContext<"/api/demo/tasks/[id]/model">) =>
    Response.redirect(await getTaskModelUrl((await params).id), 302),
);
