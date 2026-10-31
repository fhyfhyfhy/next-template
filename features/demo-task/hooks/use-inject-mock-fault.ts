"use client";

import { useMutation, useQueryClient } from "@/lib/react-query";

import {
  getMockFaultsQueryOptions,
  type MockFault,
} from "../api/get-mock-faults";
import { updateMockFaultsMutationOptions } from "../api/update-mock-faults";

export type MockFaultInput = Pick<MockFault, "method" | "path"> &
  Partial<Omit<MockFault, "method" | "path">>;

/** 在 Mock API 现有的故障配置后面追加一条故障，不覆盖故障面板里已有的配置。 */
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
