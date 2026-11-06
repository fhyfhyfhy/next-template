"use client";

import { useTranslations } from "next-intl";

import { useMutation, useQueryClient } from "@/lib/react-query";

import { getDemoFaultsQueryOptions } from "../api/get-demo-faults";
import { updateDemoFaultsMutationOptions } from "../api/update-demo-faults";
import type { DemoFault } from "../types/demo-fault";

export type DemoFaultInput = Pick<DemoFault, "operation" | "kind"> &
  Partial<Omit<DemoFault, "operation" | "kind">>;

/**
 * 在现有的故障配置后面追加一条故障，不覆盖故障面板里已有的配置。返回是否加上了：没加上时实验无从演示，
 * 调用方停下即可。写入失败由 `updateDemoFaultsMutationOptions` 的 `meta.errorMessage` 提示；读取现有配置
 * 失败时，故障 query 还没有数据就不提示（`lib/react-query.ts` 的默认 `suppressErrorToast`）。
 */
export function useInjectDemoFault() {
  const queryClient = useQueryClient();
  const t = useTranslations();
  const update = useMutation(updateDemoFaultsMutationOptions(t));
  return async (fault: DemoFaultInput): Promise<boolean> => {
    try {
      const current = await queryClient.fetchQuery({
        ...getDemoFaultsQueryOptions(),
        staleTime: 0,
      });
      await update.mutateAsync([
        ...current,
        { latencyMs: 0, code: null, status: null, times: null, ...fault },
      ]);
      return true;
    } catch {
      return false;
    }
  };
}
