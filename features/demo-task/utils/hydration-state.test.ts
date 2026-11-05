import { expect, test } from "vitest";

import {
  dehydrate,
  type HandleRequestErrorOptions,
  QueryClient,
} from "@/lib/react-query";

import { omitFunctionMeta } from "./hydration-state";

function dehydrateWithMeta(meta: HandleRequestErrorOptions) {
  const queryClient = new QueryClient();
  queryClient.getQueryCache().build(queryClient, { queryKey: ["task"], meta });
  queryClient
    .getMutationCache()
    .build(queryClient, { mutationKey: ["task"], meta });
  return dehydrate(queryClient, {
    shouldDehydrateQuery: () => true,
    shouldDehydrateMutation: () => true,
  });
}

test("去掉 query 和 mutation 的 meta 里所有函数值，保留其他字段，不修改原对象", () => {
  const state = dehydrateWithMeta({
    suppressErrorToast: () => true,
    errorMessage: () => "删除失败",
    source: "feed",
  });

  const result = omitFunctionMeta(state);

  expect(result.queries[0]?.meta).toStrictEqual({ source: "feed" });
  expect(result.mutations[0]?.meta).toStrictEqual({ source: "feed" });
  expect(result.queries[0]?.queryHash).toBe(state.queries[0]?.queryHash);
  expect(state.queries[0]?.meta?.errorMessage).toBeTypeOf("function");
});

test("meta 里没有函数值的条目原样返回", () => {
  const state = dehydrateWithMeta({
    errorMessage: "删除失败",
    suppressErrorToast: true,
  });

  const result = omitFunctionMeta(state);

  expect(result.queries[0]).toBe(state.queries[0]);
  expect(result.mutations[0]).toBe(state.mutations[0]);
});
