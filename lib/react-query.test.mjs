import { expect, onTestFinished, test } from "vitest";

import { environmentManager, noop, QueryClient } from "./react-query.ts";

const fail = () => Promise.reject(new Error("boom"));

test("refuses custom caches, which would bypass the global error handling", () => {
  const owner = new QueryClient();
  const queryCache = owner.getQueryCache();
  const mutationCache = owner.getMutationCache();
  for (const caches of [
    { queryCache },
    { mutationCache },
    { queryCache, mutationCache },
  ]) {
    expect(() => new QueryClient({ ...caches, onRequestError: noop })).toThrow(
      expect.objectContaining({
        name: "TypeError",
        message:
          "QueryClient does not accept queryCache or mutationCache; use onRequestError for global error handling.",
      }),
    );
  }
});

test("an explicit undefined does not override the caches' global error handling", async () => {
  const calls = [];
  const client = new QueryClient({
    queryCache: undefined,
    mutationCache: undefined,
    onRequestError: (error) => calls.push(error.message),
  });
  await client
    .query({ queryKey: ["undefined-cache"], queryFn: fail })
    .catch(noop);
  await expect(
    client.getMutationCache().build(client, { mutationFn: fail }).execute(),
  ).rejects.toThrow();
  expect(calls).toStrictEqual(["boom", "boom"]);
});

test("the server fixes the gcTime of queries and mutations at Infinity, and the browser keeps the hook's value", async () => {
  onTestFinished(() =>
    environmentManager.setIsServer(() => typeof window === "undefined"),
  );
  for (const [isServer, expected] of [
    [true, Infinity],
    [false, 1000],
  ]) {
    environmentManager.setIsServer(() => isServer);
    const client = new QueryClient();
    await client.query({ queryKey: ["gc"], queryFn: () => 1, gcTime: 1000 });
    expect(client.getQueryCache().find({ queryKey: ["gc"] }).gcTime).toBe(
      expected,
    );
    const mutation = client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.resolve(1), gcTime: 1000 });
    await mutation.execute(undefined);
    expect(mutation.gcTime).toBe(expected);
    client.clear();
  }
});

test("a query's failed first load shows no toast and a failed refresh with data shows one, and meta overrides the defaults field by field", async () => {
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
  expect(calls).toStrictEqual([
    ["boom", { suppressErrorToast: true }],
    ["boom", { suppressErrorToast: false }],
    ["boom", { suppressErrorToast: false }],
  ]);
});

test("a failed mutation shows a toast by default, and its meta reaches the handler as it is", async () => {
  const calls = [];
  const client = new QueryClient({
    onRequestError: (error, options) => calls.push([error.message, options]),
  });
  const cache = client.getMutationCache();
  await expect(
    cache.build(client, { mutationFn: fail }).execute(),
  ).rejects.toThrow();
  await expect(
    cache
      .build(client, { mutationFn: fail, meta: { suppressErrorToast: true } })
      .execute(),
  ).rejects.toThrow();
  expect(calls).toStrictEqual([
    ["boom", {}],
    ["boom", { suppressErrorToast: true }],
  ]);
});
