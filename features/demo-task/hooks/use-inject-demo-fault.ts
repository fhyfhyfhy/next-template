"use client";

import { useTranslations } from "next-intl";

import { useMutation, useQueryClient } from "@/lib/react-query";

import { getDemoFaultsQueryOptions } from "../api/get-demo-faults";
import { updateDemoFaultsMutationOptions } from "../api/update-demo-faults";
import type { DemoFault } from "../types/demo-fault";

export type DemoFaultInput = Pick<DemoFault, "operation" | "kind"> &
  Partial<Omit<DemoFault, "operation" | "kind">>;

/** 在现有的故障配置后面追加一条故障，不覆盖故障面板里已有的配置。 */
export function useInjectDemoFault() {
  const queryClient = useQueryClient();
  const t = useTranslations("demo-task");
  const update = useMutation(updateDemoFaultsMutationOptions(t));
  return async (fault: DemoFaultInput) => {
    const current = await queryClient.fetchQuery({
      ...getDemoFaultsQueryOptions(),
      staleTime: 0,
    });
    await update.mutateAsync([
      ...current,
      { latencyMs: 0, code: null, status: null, times: null, ...fault },
    ]);
  };
}
