import { expect, test } from "vitest";

import { createDefaultCacheHandler } from "./cache-handler.mts";

// 测试按生产环境的分支运行：vitest 不设置 __NEXT_DEV_SERVER。
// tag 记录是模块级的，所有 handler 实例共享，每个测试用自己的 tag 名。

const MAX_SIZE = 1024 * 1024;
const encoder = new TextEncoder();
const now = () => performance.timeOrigin + performance.now();
const tick = () => new Promise((resolve) => setTimeout(resolve, 2));

function entry(text, overrides = {}) {
  return {
    value: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    }),
    tags: [],
    stale: 30,
    timestamp: now(),
    revalidate: 5,
    expire: 60,
    ...overrides,
  };
}

const read = (cacheEntry) => new Response(cacheEntry.value).text();

test("过了 revalidate、没到 expire 的条目照常返回，交给 Next 在后台重新生成", async () => {
  const handler = createDefaultCacheHandler(MAX_SIZE);
  await handler.set(
    "key",
    Promise.resolve(entry("data", { timestamp: now() - 10_000 })),
  );
  const hit = await handler.get("key", []);
  expect(hit).toMatchObject({ revalidate: 5, expire: 60 });
  expect(await read(hit)).toBe("data");
  // 每次命中都是新的 stream，上一次读完不影响下一次。
  expect(await read(await handler.get("key", []))).toBe("data");
});

test("过了 expire 的条目当作没有", async () => {
  const handler = createDefaultCacheHandler(MAX_SIZE);
  await handler.set(
    "key",
    Promise.resolve(entry("data", { timestamp: now() - 61_000 })),
  );
  expect(await handler.get("key", [])).toBeUndefined();
});

test("updateTag 之后，之前写入的条目不再返回，之后写入的照常返回", async () => {
  const handler = createDefaultCacheHandler(MAX_SIZE);
  await handler.set(
    "key",
    Promise.resolve(entry("old", { tags: ["update-tag"] })),
  );
  // 上游把失效时刻四舍五入到毫秒，和条目的生成、之后的读取都要隔开 1ms 以上，比较结果才确定。
  // 实际请求里条目早在写入操作之前就生成了。
  await tick();
  await handler.updateTags(["update-tag"]);
  await tick();
  expect(await handler.get("key", [])).toBeUndefined();
  expect(await handler.getExpiration(["update-tag-unused"])).toBe(0);
  expect(await handler.getExpiration(["update-tag"])).toBeGreaterThan(0);

  await handler.set(
    "key",
    Promise.resolve(entry("new", { tags: ["update-tag"] })),
  );
  expect(await read(await handler.get("key", []))).toBe("new");
});

test("revalidateTag 带 profile 时，条目照常返回并标记为需要后台刷新", async () => {
  const handler = createDefaultCacheHandler(MAX_SIZE);
  await handler.set(
    "key",
    Promise.resolve(entry("data", { tags: ["profile-tag"] })),
  );
  await tick();
  await handler.updateTags(["profile-tag"], { expire: 60 });
  expect(await handler.get("key", [])).toMatchObject({ revalidate: -1 });
});

test("单个超过容量的条目不写入，已有条目不受影响", async () => {
  // 每个条目占 10 字节的值加 1 字节的 key。
  const handler = createDefaultCacheHandler(25);
  await handler.set("a", Promise.resolve(entry("0123456789")));
  await handler.set("b", Promise.resolve(entry("x".repeat(100))));
  expect(await handler.get("b", [])).toBeUndefined();
  expect(await handler.get("a", [])).toBeDefined();
});

test("超过容量时淘汰最久没被读到的条目", async () => {
  // 容量只够放两个 11 字节的条目。
  const handler = createDefaultCacheHandler(25);
  await handler.set("a", Promise.resolve(entry("0123456789")));
  await handler.set("b", Promise.resolve(entry("0123456789")));
  await handler.get("a", []);
  await handler.set("c", Promise.resolve(entry("0123456789")));
  expect(await handler.get("b", [])).toBeUndefined();
  expect(await handler.get("a", [])).toBeDefined();
  expect(await handler.get("c", [])).toBeDefined();
});

test("生产环境不存 expire 为 0 的条目", async () => {
  const handler = createDefaultCacheHandler(MAX_SIZE);
  await handler.set("key", Promise.resolve(entry("data", { expire: 0 })));
  expect(await handler.get("key", [])).toBeUndefined();
});

test("写入完成前的读取会等写入结束", async () => {
  const handler = createDefaultCacheHandler(MAX_SIZE);
  const pendingEntry = Promise.withResolvers();
  const writing = handler.set("key", pendingEntry.promise);
  const reading = handler.get("key", []);
  pendingEntry.resolve(entry("data"));
  await writing;
  expect(await read(await reading)).toBe("data");
});
