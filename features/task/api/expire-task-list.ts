import { mutationOptions } from "@/lib/react-query";

import { expireTaskListAction } from "./expire-task-list-action";

/** 浏览器发现列表过时后在后台调用，用户没有操作，失败也不提示：下一次变化或导航会再读取。 */
export const expireTaskListMutationOptions = () =>
  mutationOptions({
    mutationFn: expireTaskListAction,
    meta: { suppressErrorToast: true },
  });
