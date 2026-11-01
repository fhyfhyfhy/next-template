/**
 * The default `use cache` handler, loaded by cacheHandlers.default in next.config.ts.
 *
 * A copy of Next.js v16.4.3's built-in memory handler with one change: in production it keeps an
 * entry until `expire` rather than `revalidate`. Upstream, in production, treats an entry past
 * `revalidate` as missing, so the request waits for fresh data; kept until `expire`, the entry is
 * returned first by the `use cache` wrapper, which regenerates it in the background, as `next dev`
 * does (stale-while-revalidate). The change is marked "CHANGED".
 *
 * The cache lives in each process's memory and is not shared between instances: updateTag /
 * revalidateTag invalidate entries only on the instance that handled that request. Other instances
 * go on returning their own old entries: the first read past `revalidate` still gets the old data
 * and starts a background refresh, and only the reads after it get the new data.
 *
 * Sources (kept as upstream wrote them apart from the change; sync against these files when
 * upgrading Next.js):
 * - packages/next/src/server/lib/cache-handlers/default.ts
 * - packages/next/src/server/lib/lru-cache.ts
 * - packages/next/src/server/lib/incremental-cache/tags-manifest.external.ts
 * - packages/next/src/server/stream-utils/node-web-streams-helper.ts (streamFromBuffer, streamToBuffer)
 * https://github.com/vercel/next.js/tree/v16.4.3/packages/next/src/server
 *
 * Next.js is released under the MIT License:
 * The MIT License (MIT)
 * Copyright (c) 2025 Vercel, Inc.
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
 * following conditions: The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
 * LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
 * EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR
 * THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unused-vars -- upstream code is kept as it is, so that it can be compared line by line when upgrading Next.js */

// Next runs this file at runtime with Node's native import, unbundled: it may use only erasable
// TypeScript syntax and cannot import the project's modules (there is no `@/` alias at runtime), so
// the upstream files it depends on are merged into this one.
import type { CacheEntry, CacheHandler } from "next/cache";

/** Upstream's default `cacheMaxMemorySize`; that next.config option sizes only Next's built-in handler, not this one. */
const MAX_SIZE_BYTES = 50 * 1024 * 1024;

// packages/next/src/server/use-cache/constants.ts
const MIN_PRERENDERABLE_EXPIRE = 300; // 5 minutes

// ---------------------------------------------------------------------------
// packages/next/src/server/stream-utils/node-web-streams-helper.ts
// ---------------------------------------------------------------------------

function streamFromBuffer(chunk: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function streamToChunks(
  stream: ReadableStream<Uint8Array>,
): Promise<Array<Uint8Array>> {
  const reader = stream.getReader();
  const chunks: Array<Uint8Array> = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    chunks.push(value);
  }

  return chunks;
}

async function streamToBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> {
  return Buffer.concat(await streamToChunks(stream));
}

// ---------------------------------------------------------------------------
// packages/next/src/server/lib/incremental-cache/tags-manifest.external.ts
// Upstream, the built-in handler and the file system cache share this manifest; here the handler
// has its own. Next sends updateTags to every handler, and the file system cache updates the shared
// one itself, so there is no need to share it.
// ---------------------------------------------------------------------------

interface TagManifestEntry {
  stale?: number;
  expired?: number;
}

const tagsManifest = new Map<string, TagManifestEntry>();

const areTagsExpired = (tags: string[], timestamp: number) => {
  for (const tag of tags) {
    const entry = tagsManifest.get(tag);
    const expiredAt = entry?.expired;

    if (typeof expiredAt === "number") {
      const now = performance.timeOrigin + performance.now();
      // For immediate expiration (expiredAt <= now) and tag was invalidated after entry was created
      // OR for future expiration that has now passed (expiredAt > timestamp && expiredAt <= now)
      const isImmediatelyExpired = expiredAt <= now && expiredAt > timestamp;

      if (isImmediatelyExpired) {
        return true;
      }
    }
  }

  return false;
};

const areTagsStale = (tags: string[], timestamp: number) => {
  for (const tag of tags) {
    const entry = tagsManifest.get(tag);
    const staleAt = entry?.stale ?? 0;

    if (typeof staleAt === "number" && staleAt > timestamp) {
      return true;
    }
  }

  return false;
};

// ---------------------------------------------------------------------------
// packages/next/src/server/lib/lru-cache.ts
// ---------------------------------------------------------------------------

/**
 * Node in the doubly-linked list used for LRU tracking.
 * Each node represents a cache entry with bidirectional pointers.
 */
class LRUNode<T> {
  public readonly key: string;
  public data: T;
  public size: number;
  public prev: LRUNode<T> | SentinelNode<T> | null = null;
  public next: LRUNode<T> | SentinelNode<T> | null = null;

  constructor(key: string, data: T, size: number) {
    this.key = key;
    this.data = data;
    this.size = size;
  }
}

/**
 * Sentinel node used for head/tail boundaries.
 * These nodes don't contain actual cache data but simplify list operations.
 */
class SentinelNode<T> {
  public prev: LRUNode<T> | SentinelNode<T> | null = null;
  public next: LRUNode<T> | SentinelNode<T> | null = null;
}

/**
 * LRU (Least Recently Used) Cache implementation using a doubly-linked list
 * and hash map for O(1) operations.
 *
 * Algorithm:
 * - Uses a doubly-linked list to maintain access order (most recent at head)
 * - Hash map provides O(1) key-to-node lookup
 * - Sentinel head/tail nodes simplify edge case handling
 * - Size-based eviction supports custom size calculation functions
 *
 * Data Structure Layout:
 * HEAD <-> [most recent] <-> ... <-> [least recent] <-> TAIL
 *
 * Operations:
 * - get(): Move accessed node to head (mark as most recent)
 * - set(): Add new node at head, evict from tail if over capacity
 * - Eviction: Remove least recent node (tail.prev) when size exceeds limit
 */
class LRUCache<T> {
  private readonly cache: Map<string, LRUNode<T>> = new Map();
  private readonly head: SentinelNode<T>;
  private readonly tail: SentinelNode<T>;
  private totalSize: number = 0;
  private readonly maxSize: number;
  private readonly calculateSize:
    ((value: T, key: string) => number) | undefined;
  private readonly onEvict: ((key: string, value: T) => void) | undefined;

  constructor(
    maxSize: number,
    calculateSize?: (value: T, key: string) => number,
    onEvict?: (key: string, value: T) => void,
  ) {
    this.maxSize = maxSize;
    this.calculateSize = calculateSize;
    this.onEvict = onEvict;

    // Create sentinel nodes to simplify doubly-linked list operations
    // HEAD <-> TAIL (empty list)
    this.head = new SentinelNode<T>();
    this.tail = new SentinelNode<T>();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  /**
   * Adds a node immediately after the head (marks as most recently used).
   * Used when inserting new items or when an item is accessed.
   * PRECONDITION: node must be disconnected (prev/next should be null)
   */
  private addToHead(node: LRUNode<T>): void {
    node.prev = this.head;
    node.next = this.head.next;
    // head.next is always non-null (points to tail or another node)
    this.head.next!.prev = node;
    this.head.next = node;
  }

  /**
   * Removes a node from its current position in the doubly-linked list.
   * Updates the prev/next pointers of adjacent nodes to maintain list integrity.
   * PRECONDITION: node must be connected (prev/next are non-null)
   */
  private removeNode(node: LRUNode<T>): void {
    // Connected nodes always have non-null prev/next
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  /**
   * Moves an existing node to the head position (marks as most recently used).
   * This is the core LRU operation - accessed items become most recent.
   */
  private moveToHead(node: LRUNode<T>): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  /**
   * Removes and returns the least recently used node (the one before tail).
   * This is called during eviction when the cache exceeds capacity.
   * PRECONDITION: cache is not empty (ensured by caller)
   */
  private removeTail(): LRUNode<T> {
    const lastNode = this.tail.prev as LRUNode<T>;
    // tail.prev is always non-null and always LRUNode when cache is not empty
    this.removeNode(lastNode);
    return lastNode;
  }

  /**
   * Sets a key-value pair in the cache.
   * If the key exists, updates the value and moves to head.
   * If new, adds at head and evicts from tail if necessary.
   *
   * Time Complexity:
   * - O(1) for uniform item sizes
   * - O(k) where k is the number of items evicted (can be O(N) for variable sizes)
   */
  public set(key: string, value: T): boolean {
    const size = this.calculateSize?.(value, key) ?? 1;
    if (size <= 0) {
      throw new Error(
        `LRUCache: calculateSize returned ${size}, but size must be > 0. ` +
          `Items with size 0 would never be evicted, causing unbounded cache growth.`,
      );
    }
    if (size > this.maxSize) {
      console.warn("Single item size exceeds maxSize");
      return false;
    }

    const existing = this.cache.get(key);
    if (existing) {
      // Update existing node: adjust size and move to head (most recent)
      existing.data = value;
      this.totalSize = this.totalSize - existing.size + size;
      existing.size = size;
      this.moveToHead(existing);
    } else {
      // Add new node at head (most recent position)
      const newNode = new LRUNode(key, value, size);
      this.cache.set(key, newNode);
      this.addToHead(newNode);
      this.totalSize += size;
    }

    // Evict least recently used items until under capacity
    while (this.totalSize > this.maxSize && this.cache.size > 0) {
      const tail = this.removeTail();
      this.cache.delete(tail.key);
      this.totalSize -= tail.size;
      this.onEvict?.(tail.key, tail.data);
    }

    return true;
  }

  /**
   * Checks if a key exists in the cache.
   * This is a pure query operation - does NOT update LRU order.
   *
   * Time Complexity: O(1)
   */
  public has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Retrieves a value by key and marks it as most recently used.
   * Moving to head maintains the LRU property for future evictions.
   *
   * Time Complexity: O(1)
   */
  public get(key: string): T | undefined {
    const node = this.cache.get(key);
    if (!node) return undefined;

    // Mark as most recently used by moving to head
    this.moveToHead(node);

    return node.data;
  }

  /**
   * Returns an iterator over the cache entries. The order is outputted in the
   * order of most recently used to least recently used.
   */
  public *[Symbol.iterator](): IterableIterator<[string, T]> {
    let current = this.head.next;
    while (current && current !== this.tail) {
      // Between head and tail, current is always LRUNode
      const node = current as LRUNode<T>;
      yield [node.key, node.data];
      current = current.next;
    }
  }

  /**
   * Removes a specific key from the cache.
   * Updates both the hash map and doubly-linked list.
   *
   * Note: This is an explicit removal and does NOT trigger the `onEvict`
   * callback. Use this for intentional deletions where eviction tracking
   * is not needed.
   *
   * Time Complexity: O(1)
   */
  public remove(key: string): void {
    const node = this.cache.get(key);
    if (!node) return;

    this.removeNode(node);
    this.cache.delete(key);
    this.totalSize -= node.size;
  }

  /**
   * Returns the number of items in the cache.
   */
  public get size(): number {
    return this.cache.size;
  }

  /**
   * Returns the current total size of all cached items.
   * This uses the custom size calculation if provided.
   */
  public get currentSize(): number {
    return this.totalSize;
  }
}

// ---------------------------------------------------------------------------
// packages/next/src/server/lib/cache-handlers/default.ts
// ---------------------------------------------------------------------------

type PrivateCacheEntry = {
  entry: Omit<CacheEntry, "value">;
  value: Buffer;

  // For the default cache we store errored cache
  // entries and allow them to be used up to 3 times
  // after that we want to dispose it and try for fresh

  // If an entry is errored we return no entry
  // three times so that we retry hitting origin (MISS)
  // and then if it still fails to set after the third we
  // return the errored content and use expiration of
  // Math.min(30, entry.expiration)
  isErrored: boolean;
  errorRetryCount: number;

  // compute size on set since we need to read size
  // of the ReadableStream for LRU evicting
  size: number;
};

export function createDefaultCacheHandler(maxSize: number): CacheHandler {
  // If the max size is 0, return a cache handler that doesn't cache anything,
  // this avoids an unnecessary LRUCache instance and potential memory
  // allocation.
  if (maxSize === 0) {
    return {
      get: () => Promise.resolve(undefined),
      set: () => Promise.resolve(),
      refreshTags: () => Promise.resolve(),
      getExpiration: () => Promise.resolve(0),
      updateTags: () => Promise.resolve(),
    };
  }

  const memoryCache = new LRUCache<PrivateCacheEntry>(
    maxSize,
    (entry, cacheKey) => entry.size + cacheKey.length,
  );
  const pendingSets = new Map<string, Promise<void>>();

  const debug = process.env.NEXT_PRIVATE_DEBUG_CACHE
    ? console.debug.bind(console, "DefaultCacheHandler:")
    : undefined;

  return {
    async get(cacheKey) {
      const pendingPromise = pendingSets.get(cacheKey);

      if (pendingPromise) {
        debug?.("get", cacheKey, "pending");
        await pendingPromise;
      }

      const privateEntry = memoryCache.get(cacheKey);

      if (!privateEntry) {
        debug?.("get", cacheKey, "not found");
        return undefined;
      }

      const entry = privateEntry.entry;

      // A negative `expire` is an eviction sentinel: the tiered cache handler
      // (dev-only) marks a front entry for deletion by overwriting it with a
      // negative `expire`, since the cache-handler interface has no per-key
      // delete. Treat it as missing here, independently of the minimum
      // retention below (which would otherwise keep it alive). This is distinct
      // from `revalidate = -1` below, which keeps serving the entry but forces
      // a revalidation.
      if (entry.expire < 0) {
        debug?.("get", cacheKey, "evicted");
        return undefined;
      }

      // CHANGED: upstream, in production, uses `entry.revalidate` and drops an entry past revalidate.
      // Here production also keeps it until `expire`: an entry past revalidate is returned, and the
      // use cache wrapper answers with it first and then regenerates it in the background.
      // The dev branch is as upstream wrote it: it keeps an entry at least `MIN_PRERENDERABLE_EXPIRE`,
      // so that one with a very short `expire` still hits on a reload.
      const maxAgeSeconds = process.env.__NEXT_DEV_SERVER
        ? Math.max(entry.expire, MIN_PRERENDERABLE_EXPIRE)
        : entry.expire;

      if (
        performance.timeOrigin + performance.now() >
        entry.timestamp + maxAgeSeconds * 1000
      ) {
        debug?.("get", cacheKey, "expired");

        return undefined;
      }

      let revalidate = entry.revalidate;

      if (areTagsExpired(entry.tags, entry.timestamp)) {
        debug?.("get", cacheKey, "had expired tag");
        return undefined;
      }

      if (areTagsStale(entry.tags, entry.timestamp)) {
        debug?.("get", cacheKey, "had stale tag");
        revalidate = -1;
      }

      debug?.("get", cacheKey, "found", {
        tags: entry.tags,
        timestamp: entry.timestamp,
        expire: entry.expire,
        revalidate,
        stale: entry.stale,
      });

      return {
        ...entry,
        revalidate,
        value: streamFromBuffer(privateEntry.value),
      };
    },

    async set(cacheKey, pendingEntry) {
      debug?.("set", cacheKey, "start");

      let resolvePending: () => void = () => {};
      const pendingPromise = new Promise<void>((resolve) => {
        resolvePending = resolve;
      });
      pendingSets.set(cacheKey, pendingPromise);

      const entry = await pendingEntry;

      try {
        // In production an `expire: 0` entry is dynamic: the "use cache"
        // wrapper regenerates it on every read instead of serving the stored
        // copy, so persisting it would be a wasted write of a value that is
        // never served back. Skip storing it so the next read is a plain miss.
        // The dev server keeps it, because its minimum retention serves the
        // previously cached value across reloads. The `finally` below still
        // resolves the pending set.
        if (!process.env.__NEXT_DEV_SERVER && entry.expire === 0) {
          debug?.("set", cacheKey, "skipped dynamic entry");
          return;
        }

        const value = await streamToBuffer(entry.value);
        const { value: _, ...entryMetadata } = entry;

        memoryCache.set(cacheKey, {
          entry: entryMetadata,
          value,
          isErrored: false,
          errorRetryCount: 0,
          size: value.byteLength,
        });

        debug?.("set", cacheKey, "done");
      } catch (err) {
        // TODO: store partial buffer with error after we retry 3 times
        debug?.("set", cacheKey, "failed", err);
      } finally {
        resolvePending();
        pendingSets.delete(cacheKey);
      }
    },

    async refreshTags() {
      // Nothing to do for an in-memory cache handler.
    },

    async getExpiration(tags) {
      const expirations = tags.map((tag) => {
        const entry = tagsManifest.get(tag);
        if (!entry) return 0;
        // Return the most recent timestamp (either expired or stale)
        return entry.expired || 0;
      });

      const expiration = Math.max(...expirations, 0);

      debug?.("getExpiration", { tags, expiration });

      return expiration;
    },

    async updateTags(tags, durations) {
      const now = Math.round(performance.timeOrigin + performance.now());
      debug?.("updateTags", { tags, timestamp: now });

      for (const tag of tags) {
        // TODO: update file-system-cache?
        const existingEntry = tagsManifest.get(tag) || {};

        if (durations) {
          // Use provided durations directly
          const updates: TagManifestEntry = { ...existingEntry };

          // mark as stale immediately
          updates.stale = now;

          if (durations.expire !== undefined) {
            updates.expired = now + durations.expire * 1000; // Convert seconds to ms
          }

          tagsManifest.set(tag, updates);
        } else {
          // Update expired field for immediate expiration (default behavior when no durations provided)
          tagsManifest.set(tag, { ...existingEntry, expired: now });
        }
      }
    },
  };
}

export default createDefaultCacheHandler(MAX_SIZE_BYTES);
