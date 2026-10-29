import { z } from "zod";

import { fetchApi } from "@/lib/fetch";
import { mutationOptions } from "@/lib/react-query";

import { expireTaskListAction } from "./expire-task-list-action";

const resetMock = () =>
  fetchApi({
    url: "/__mock/reset",
    method: "POST",
    data: {},
    schema: z.null(),
    auth: false,
  });

/**
 * 把 Mock API 恢复成种子数据并清除故障。重置不经过 Next 服务端，列表页的服务端缓存要单独失效；
 * 浏览器里所有 query 也都可能过期，统一 invalidate。
 */
export const resetMockMutationOptions = () =>
  mutationOptions({
    mutationFn: resetMock,
    onSuccess: async (_data, _variables, _onMutateResult, { client }) => {
      await expireTaskListAction();
      void client.invalidateQueries();
    },
  });
