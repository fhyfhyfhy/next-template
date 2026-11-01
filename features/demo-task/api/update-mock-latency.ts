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

/**
 * Changes the default latency of the Mock API's business endpoints. It applies
 * to the requests of every Data demo page and is restored when the Mock data is
 * reset.
 */
export const updateMockLatencyMutationOptions = () =>
  mutationOptions({
    mutationFn: updateMockLatency,
    onSuccess: (latencyMs, _variables, _onMutateResult, { client }) => {
      client.setQueryData(getMockLatencyQueryOptions().queryKey, latencyMs);
    },
  });
