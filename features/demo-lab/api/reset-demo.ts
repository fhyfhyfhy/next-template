import { mutationOptions } from "@/lib/react-query";

import type { DemoLabTranslator } from "../types/translator";
import { resetDemoAction } from "./reset-demo-action";

/**
 * 重置 Demo 数据。浏览器里所有 query 都可能过期，统一 invalidate，并等它们重新请求完才算重置成功：
 * 故障按操作匹配，e2e 在重置成功后立即注入的故障会被还在路上的请求用掉次数。
 */
export const resetDemoMutationOptions = (t: DemoLabTranslator) =>
  mutationOptions({
    mutationFn: () => resetDemoAction(),
    onSuccess: async (_data, _variables, _onMutateResult, { client }) => {
      await client.invalidateQueries();
    },
    meta: { errorMessage: t("demoReset.failed") },
  });
