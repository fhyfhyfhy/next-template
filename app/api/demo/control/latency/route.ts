import { z } from "zod";

import {
  demoRoute,
  getDefaultLatency,
  setDefaultLatency,
} from "@/features/demo-faults/server";
import { readJsonBody } from "@/lib/route-handler";

export const GET = demoRoute(async () => ({
  latencyMs: await getDefaultLatency(),
}));

/** 设置业务操作的默认延迟，请求体为 `{ latencyMs }`，0 到 30000 的整数。 */
export const PUT = demoRoute(async (request) => {
  const { latencyMs } = await readJsonBody(
    request,
    z.object({ latencyMs: z.unknown() }),
  );
  return { latencyMs: await setDefaultLatency(latencyMs) };
});
