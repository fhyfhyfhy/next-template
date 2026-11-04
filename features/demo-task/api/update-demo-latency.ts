import { mutationOptions } from "@/lib/react-query";

import type { DemoTaskTranslator } from "../types/translator";
import { getDemoLatencyQueryOptions } from "./get-demo-latency";
import { updateDemoLatencyAction } from "./update-demo-latency-action";

/** 修改业务操作的默认延迟，对所有 Data demo 页面的数据层调用生效，重置 Demo 数据时恢复。 */
export const updateDemoLatencyMutationOptions = (t: DemoTaskTranslator) =>
  mutationOptions({
    mutationFn: updateDemoLatencyAction,
    onSuccess: (latencyMs, _variables, _onMutateResult, { client }) => {
      client.setQueryData(getDemoLatencyQueryOptions().queryKey, latencyMs);
    },
    meta: { errorMessage: t("defaultLatency.updateFailed") },
  });
