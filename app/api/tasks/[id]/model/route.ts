import { getTaskModelUrl } from "@/features/task/server";
import { routeHandler } from "@/lib/request/route-handler";

/** done 任务的模型：302 到对象存储的短期下载地址，文件不经过 Next；没完成时返回 409 和 TASK_NOT_DONE。 */
export const GET = routeHandler(
  async (_request, { params }: RouteContext<"/api/tasks/[id]/model">) =>
    Response.redirect(await getTaskModelUrl((await params).id), 302),
);
