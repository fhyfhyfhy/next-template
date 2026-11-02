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
 * 浏览器里所有 query 也都可能过期，统一 invalidate，并等它们重新请求完才算重置成功：
 * 故障按路由模式匹配，e2e 在重置成功后立即注入的故障会被还在路上的请求用掉次数。
 */
export const resetMockMutationOptions = () =>
  mutationOptions({
    mutationFn: resetMock,
    onSuccess: async (_data, _variables, _onMutateResult, { client }) => {
      await expireTaskListAction();
      await client.invalidateQueries();
    },
  });
