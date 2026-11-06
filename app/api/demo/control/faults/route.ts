import { z } from "zod";

import {
  demoRoute,
  listFaults,
  replaceFaults,
} from "@/features/demo-faults/server";
import { readJsonBody } from "@/lib/route-handler";

export const GET = demoRoute(async () => ({ faults: await listFaults() }));

/** 整体替换故障列表，请求体为 `{ faults }`，每条的字段见 demo-task 的 `demoFaultSchema`。 */
export const PUT = demoRoute(async (request) => {
  const { faults } = await readJsonBody(
    request,
    z.object({ faults: z.unknown() }),
  );
  return { faults: await replaceFaults(faults) };
});
