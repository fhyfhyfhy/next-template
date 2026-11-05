import { z } from "zod";

import {
  demoRoute,
  readJsonBody,
  setClockPaused,
} from "@/features/demo-task/server";

/** 暂停或恢复 Demo generator 的自动推进，请求体为 `{ paused }`。 */
export const POST = demoRoute(async (request) => {
  const { paused } = await readJsonBody(
    request,
    z.object({ paused: z.unknown() }),
  );
  return { paused: await setClockPaused(paused) };
});
