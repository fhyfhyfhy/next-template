import { fetchApi } from "@/lib/fetch";
import { mutationOptions } from "@/lib/react-query";

import {
  getMockFaultsQueryOptions,
  type MockFault,
  mockFaultListSchema,
} from "./get-mock-faults";

const updateMockFaults = (faults: MockFault[]) =>
  fetchApi({
    url: "/__mock/faults",
    method: "PUT",
    data: {
      faults: faults.map(({ latencyMs, ...fault }) => ({
        ...fault,
        latency_ms: latencyMs,
      })),
    },
    schema: mockFaultListSchema,
    auth: false,
  });

/** 整体替换 Mock API 的故障配置，配置对所有 Data demo 页面的请求生效。 */
export const updateMockFaultsMutationOptions = () =>
  mutationOptions({
    mutationFn: updateMockFaults,
    onSuccess: ({ faults }, _variables, _onMutateResult, { client }) => {
      client.setQueryData(getMockFaultsQueryOptions().queryKey, faults);
    },
  });
