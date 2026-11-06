import type { Translator } from "@/lib/i18n/translator";
import { mutationOptions } from "@/lib/react-query";

import { getDemoFaultsQueryOptions } from "./get-demo-faults";
import { updateDemoFaultsAction } from "./update-demo-faults-action";

/** 整体替换故障列表，配置对所有 Data demo 页面的数据层调用生效。数据层按传入的顺序原样保存，所以乐观写入的就是结果。 */
export const updateDemoFaultsMutationOptions = (t: Translator) => {
  const { queryKey } = getDemoFaultsQueryOptions();
  return mutationOptions({
    mutationFn: updateDemoFaultsAction,
    onMutate: async (faults, { client }) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData(queryKey);
      client.setQueryData(queryKey, faults);
      return { previous };
    },
    onError: (_error, _variables, onMutateResult, { client }) => {
      client.setQueryData(queryKey, onMutateResult?.previous);
    },
    onSettled: (_data, _error, _variables, _onMutateResult, { client }) =>
      client.invalidateQueries({ queryKey }),
    meta: { errorMessage: t("demo-faults.faultPanel.updateFailed") },
  });
};
