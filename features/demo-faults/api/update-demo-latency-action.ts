"use server";

import { assertDemoBackendEnabled } from "@/lib/demo-backend";

import { setDefaultLatency } from "../server/faults";

/** 修改业务操作的默认延迟，0 到 30000 的整数，由数据层校验；重置时恢复成 500。 */
export async function updateDemoLatencyAction(latencyMs: number) {
  assertDemoBackendEnabled();
  return setDefaultLatency(latencyMs);
}
