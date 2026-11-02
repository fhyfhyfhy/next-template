"use client";

import { useMutation, useQueryClient } from "@/lib/react-query";

import {
  getMockFaultsQueryOptions,
  type MockFault,
} from "../api/get-mock-faults";
import { updateMockFaultsMutationOptions } from "../api/update-mock-faults";

export type MockFaultInput = Pick<MockFault, "method" | "path"> &
  Partial<Omit<MockFault, "method" | "path">>;

/**
 * Appends a fault to the Mock API's current fault config, keeping what the
 * fault panel already has.
 */
export function useInjectMockFault() {
  const queryClient = useQueryClient();
  const update = useMutation(updateMockFaultsMutationOptions());
  return async (fault: MockFaultInput) => {
    const current = await queryClient.fetchQuery({
      ...getMockFaultsQueryOptions(),
      staleTime: 0,
    });
    await update.mutateAsync([
      ...current,
      {
        latencyMs: 0,
        status: null,
        code: null,
        malformed: false,
        times: null,
        ...fault,
      },
    ]);
  };
}
