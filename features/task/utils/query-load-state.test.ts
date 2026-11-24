import { afterEach, expect, onTestFinished, test } from "vitest";

import { onlineManager, QueryClient, QueryObserver } from "@/lib/react-query";

import { isQueryLoadFailed } from "./query-load-state";

// 判断读的是 React Query 结果里的字段，字段在各种时刻的取值由 query-core 决定，所以用真实的 QueryObserver
// 产生结果；请求由用例决定何时失败。

const queryKey = ["task", "detail", "load-state"];
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const unsubscribers: (() => void)[] = [];
const pendingRequests: (() => void)[] = [];

afterEach(() => {
  unmountAll();
  pendingRequests.length = 0;
  client.clear();
});

function queryFn() {
  return new Promise<string>((_resolve, reject) => {
    pendingRequests.push(() => reject(new Error("boom")));
  });
}

/** 让最早发出、还没结束的请求失败，等 `observer` 通知订阅者的结果里带上这次的错误。 */
function failRequest(observer: ReturnType<typeof mount>) {
  const failed = new Promise<void>((resolve) => {
    const unsubscribe = observer.subscribe((result) => {
      if (result.error === null) return;
      unsubscribe();
      resolve();
    });
  });
  pendingRequests.shift()?.();
  return failed;
}

/** 像组件挂载一样订阅 query：没有数据或数据过期时，订阅就会发请求。 */
function mount() {
  const observer = new QueryObserver(client, { queryKey, queryFn });
  unsubscribers.push(observer.subscribe(() => {}));
  return observer;
}

function unmountAll() {
  for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
}

test("首次请求还在进行、没有失败过：不算加载失败", () => {
  const result = mount().getCurrentResult();

  expect(result.fetchStatus).toBe("fetching");
  expect(isQueryLoadFailed(result)).toBe(false);
});

test("首次请求失败：算加载失败", async () => {
  const observer = mount();
  await failRequest(observer);

  expect(isQueryLoadFailed(observer.getCurrentResult())).toBe(true);
});

test("本次挂载里失败过，重试进行中 error 被清空，仍算加载失败", async () => {
  const observer = mount();
  await failRequest(observer);

  void observer.refetch();
  const result = observer.getCurrentResult();

  expect(result.fetchStatus).toBe("fetching");
  expect(result.error).toBeNull();
  expect(isQueryLoadFailed(result)).toBe(true);
});

test("本次挂载里失败过，重试因为离线暂停、error 被清空，仍算加载失败", async () => {
  const observer = mount();
  await failRequest(observer);
  onlineManager.setOnline(false);
  onTestFinished(() => onlineManager.setOnline(true));

  void observer.refetch();
  const result = observer.getCurrentResult();

  expect(result.fetchStatus).toBe("paused");
  expect(result.error).toBeNull();
  expect(isQueryLoadFailed(result)).toBe(true);
});

test("有数据时刷新失败：不算加载失败，继续显示数据", async () => {
  client.setQueryData(queryKey, "旧数据");
  const observer = mount();
  await failRequest(observer);
  const result = observer.getCurrentResult();

  expect(result.error).not.toBeNull();
  expect(isQueryLoadFailed(result)).toBe(false);
});

test("之前失败过的 query 重新挂载（新的 observer）、重新请求期间：不算加载失败，显示加载中", async () => {
  await failRequest(mount());
  unmountAll();

  const result = mount().getCurrentResult();

  expect(result.fetchStatus).toBe("fetching");
  expect(isQueryLoadFailed(result)).toBe(false);
});
