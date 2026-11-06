import { demoRoute } from "@/features/demo-faults/server";
import { streamTaskLogs } from "@/features/demo-task/server";

/** 生成日志的 SSE 流，事件格式见 `streamTaskLogs`。客户端断开时 `request.signal` 中止，流随之结束。 */
export const GET = demoRoute(
  async (request, { params }: RouteContext<"/api/demo/tasks/[id]/logs">) =>
    new Response(await streamTaskLogs((await params).id, request.signal), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    }),
);
