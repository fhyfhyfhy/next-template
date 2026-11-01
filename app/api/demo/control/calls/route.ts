import { demoRoute, listCalls } from "@/features/demo-task/server";

/** 重置以来的调用记录；`operation` 只看这个操作。 */
export const GET = demoRoute(async (request) => ({
  calls: await listCalls(
    new URL(request.url).searchParams.get("operation") ?? undefined,
  ),
}));
