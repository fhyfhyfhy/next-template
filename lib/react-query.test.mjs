import assert from "node:assert/strict";
import test from "node:test";

import { environmentManager, noop, QueryClient } from "./react-query.ts";

const fail = () => Promise.reject(new Error("boom"));

test("服务端把 query 和 mutation 的 gcTime 固定为 Infinity，浏览器保留 hook 传入的值", async (t) => {
  t.after(() =>
    environmentManager.setIsServer(() => typeof window === "undefined"),
  );
  for (const [isServer, expected] of [
    [true, Infinity],
    [false, 1000],
  ]) {
    environmentManager.setIsServer(() => isServer);
    const client = new QueryClient();
    await client.query({ queryKey: ["gc"], queryFn: () => 1, gcTime: 1000 });
    assert.equal(
      client.getQueryCache().find({ queryKey: ["gc"] }).gcTime,
      expected,
    );
    const mutation = client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.resolve(1), gcTime: 1000 });
    await mutation.execute(undefined);
    assert.equal(mutation.gcTime, expected);
    client.clear();
  }
});

test("query 首次加载失败不提示、已有数据时刷新失败提示，meta 逐字段覆盖默认值", async () => {
  const calls = [];
  const client = new QueryClient({
    onRequestError: (error, options) => calls.push([error.message, options]),
  });
  await client.query({ queryKey: ["a"], queryFn: fail }).catch(noop);
  client.setQueryData(["refresh"], "cached");
  await client
    .query({ queryKey: ["refresh"], queryFn: fail, staleTime: 0 })
    .catch(noop);
  await client
    .query({
      queryKey: ["b"],
      queryFn: fail,
      meta: { suppressErrorToast: false },
    })
    .catch(noop);
  assert.deepEqual(calls, [
    ["boom", { suppressErrorToast: true }],
    ["boom", { suppressErrorToast: false }],
    ["boom", { suppressErrorToast: false }],
  ]);
});

test("mutation 失败默认提示，meta 原样传给 handler", async () => {
  const calls = [];
  const client = new QueryClient({
    onRequestError: (error, options) => calls.push([error.message, options]),
  });
  const cache = client.getMutationCache();
  await assert.rejects(cache.build(client, { mutationFn: fail }).execute());
  await assert.rejects(
    cache
      .build(client, { mutationFn: fail, meta: { suppressErrorToast: true } })
      .execute(),
  );
  assert.deepEqual(calls, [
    ["boom", {}],
    ["boom", { suppressErrorToast: true }],
  ]);
});
