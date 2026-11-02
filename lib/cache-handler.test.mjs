import { expect, test } from "vitest";

import { createDefaultCacheHandler } from "./cache-handler.mts";

// The tests run the production branch: vitest does not set __NEXT_DEV_SERVER.
// The tag records are module-level and shared by every handler instance, so each test uses its own
// tag names.

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

test("an entry past revalidate but not expire is returned, for Next to regenerate in the background", async () => {
  const handler = createDefaultCacheHandler(MAX_SIZE);
  await handler.set(
    "key",
    Promise.resolve(entry("data", { timestamp: now() - 10_000 })),
  );
  const hit = await handler.get("key", []);
  expect(hit).toMatchObject({ revalidate: 5, expire: 60 });
  expect(await read(hit)).toBe("data");
  // Each hit is a new stream: reading one to the end does not affect the next.
  expect(await read(await handler.get("key", []))).toBe("data");
});

test("an entry past expire is treated as missing", async () => {
  const handler = createDefaultCacheHandler(MAX_SIZE);
  await handler.set(
    "key",
    Promise.resolve(entry("data", { timestamp: now() - 61_000 })),
  );
  expect(await handler.get("key", [])).toBeUndefined();
});

test("after updateTag, entries written before it are no longer returned, and those written after are", async () => {
  const handler = createDefaultCacheHandler(MAX_SIZE);
  await handler.set(
    "key",
    Promise.resolve(entry("old", { tags: ["update-tag"] })),
  );
  // Upstream rounds the invalidation time to the millisecond, so it must be more than 1ms apart
  // from the entry's creation and from the later read for the comparison to be deterministic.
  // In a real request the entry is created long before the write.
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

test("revalidateTag with a profile keeps returning the entry, marked for a background refresh", async () => {
  const handler = createDefaultCacheHandler(MAX_SIZE);
  await handler.set(
    "key",
    Promise.resolve(entry("data", { tags: ["profile-tag"] })),
  );
  await tick();
  await handler.updateTags(["profile-tag"], { expire: 60 });
  expect(await handler.get("key", [])).toMatchObject({ revalidate: -1 });
});

test("an entry larger than the capacity is not written, and existing entries are unaffected", async () => {
  // Each entry takes a 10-byte value plus a 1-byte key.
  const handler = createDefaultCacheHandler(25);
  await handler.set("a", Promise.resolve(entry("0123456789")));
  await handler.set("b", Promise.resolve(entry("x".repeat(100))));
  expect(await handler.get("b", [])).toBeUndefined();
  expect(await handler.get("a", [])).toBeDefined();
});

test("over capacity, the least recently read entry is evicted", async () => {
  // The capacity holds only two 11-byte entries.
  const handler = createDefaultCacheHandler(25);
  await handler.set("a", Promise.resolve(entry("0123456789")));
  await handler.set("b", Promise.resolve(entry("0123456789")));
  await handler.get("a", []);
  await handler.set("c", Promise.resolve(entry("0123456789")));
  expect(await handler.get("b", [])).toBeUndefined();
  expect(await handler.get("a", [])).toBeDefined();
  expect(await handler.get("c", [])).toBeDefined();
});

test("production does not store an entry whose expire is 0", async () => {
  const handler = createDefaultCacheHandler(MAX_SIZE);
  await handler.set("key", Promise.resolve(entry("data", { expire: 0 })));
  expect(await handler.get("key", [])).toBeUndefined();
});

test("a read before a write completes waits for the write", async () => {
  const handler = createDefaultCacheHandler(MAX_SIZE);
  const pendingEntry = Promise.withResolvers();
  const writing = handler.set("key", pendingEntry.promise);
  const reading = handler.get("key", []);
  pendingEntry.resolve(entry("data"));
  await writing;
  expect(await read(await reading)).toBe("data");
});
