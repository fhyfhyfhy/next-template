import { z } from "zod";

import { demoRoute } from "@/features/demo-faults/server";
import { renameTaskRecord } from "@/features/demo-task/server";
import { readJsonBody } from "@/lib/route-handler";

/**
 * 模拟别的客户端给任务改名，请求体为 `{ name }`：和页面上的改名走同一个数据层函数，但不让 Next 的缓存失效，
 * 页面要靠自己的刷新机制发现变化。
 */
export const POST = demoRoute(
  async (
    request,
    { params }: RouteContext<"/api/demo/control/tasks/[id]/rename">,
  ) => {
    const { name } = await readJsonBody(
      request,
      z.object({ name: z.unknown() }),
    );
    return renameTaskRecord((await params).id, { name });
  },
);
