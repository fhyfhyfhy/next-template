"use server";

import { assertDemoBackendEnabled } from "@/lib/demo-backend";

import { replaceFaults } from "../server/faults";
import type { DemoFault } from "../types/demo-fault";

/** 整体替换故障列表，对所有 Data demo 页面的数据层调用生效。输入由数据层校验。 */
export async function updateDemoFaultsAction(
  faults: DemoFault[],
): Promise<DemoFault[]> {
  assertDemoBackendEnabled();
  return replaceFaults(faults);
}
