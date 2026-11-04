import { mutationOptions } from "@/lib/react-query";

import type { DemoTaskTranslator } from "../types/translator";
import { getDemoFaultsQueryOptions } from "./get-demo-faults";
import { updateDemoFaultsAction } from "./update-demo-faults-action";

/** 整体替换故障列表，配置对所有 Data demo 页面的数据层调用生效。 */
export const updateDemoFaultsMutationOptions = (t: DemoTaskTranslator) =>
  mutationOptions({
    mutationFn: updateDemoFaultsAction,
    onSuccess: (faults, _variables, _onMutateResult, { client }) => {
      client.setQueryData(getDemoFaultsQueryOptions().queryKey, faults);
    },
    meta: { errorMessage: t("faultPanel.updateFailed") },
  });
