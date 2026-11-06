import type { Translator } from "@/lib/i18n/translator";
import { mutationOptions } from "@/lib/react-query";

import { setDraftModeAction } from "./set-draft-mode-action";

/** 开关写的是 cookie，没有 query 显示它：服务端读出状态传给 `LabDraftMode`，action 的响应带回刷新后的页面。 */
export const setDraftModeMutationOptions = (t: Translator) =>
  mutationOptions({
    mutationFn: setDraftModeAction,
    meta: { errorMessage: t("demo-lab.labDraftMode.switchFailed") },
  });
