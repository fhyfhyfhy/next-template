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

/**
 * Replaces the Mock API's whole fault config, which applies to the requests of
 * every Data demo page.
 */
export const updateMockFaultsMutationOptions = () =>
  mutationOptions({
    mutationFn: updateMockFaults,
    onSuccess: ({ faults }, _variables, _onMutateResult, { client }) => {
      client.setQueryData(getMockFaultsQueryOptions().queryKey, faults);
    },
  });
