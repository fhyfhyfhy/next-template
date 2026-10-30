import { fetchApi } from "@/lib/fetch";
import { mutationOptions } from "@/lib/react-query";

import {
  getMockLatencyQueryOptions,
  mockLatencySchema,
} from "./get-mock-latency";

const updateMockLatency = (latencyMs: number) =>
  fetchApi({
    url: "/__mock/latency",
    method: "PUT",
    data: { latency_ms: latencyMs },
    schema: mockLatencySchema,
    auth: false,
  });

/** 修改 Mock API 业务接口的默认延迟，对所有 Data demo 页面的请求生效，重置 Mock 数据时恢复。 */
export const updateMockLatencyMutationOptions = () =>
  mutationOptions({
    mutationFn: updateMockLatency,
    onSuccess: (latencyMs, _variables, _onMutateResult, { client }) => {
      client.setQueryData(getMockLatencyQueryOptions().queryKey, latencyMs);
    },
  });
