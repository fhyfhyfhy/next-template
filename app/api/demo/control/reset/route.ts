import { z } from "zod";

import {
  demoRoute,
  readJsonBody,
  resetDemo,
} from "@/features/demo-task/server";

// /api/demo/control/* 是故障实验室和 e2e 用的控制接口，只在 Demo 后端启用时存在；不加默认延迟，也不受注入的故障影响。

const bodySchema = z.object({ paused: z.boolean().optional() }).nullable();

/** 恢复种子数据，清除故障和调用记录；请求体的 `paused` 同时设置时钟，不传时保持当前状态。 */
export const POST = demoRoute(async (request) => {
  const body = await readJsonBody(request, bodySchema);
  await resetDemo({ paused: body?.paused });
  return new Response(null, { status: 204 });
});
