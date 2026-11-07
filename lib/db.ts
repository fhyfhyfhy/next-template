import "server-only";
import { Kysely, PostgresDialect } from "kysely";
import { Client, Pool } from "pg";

import { env } from "./env";

declare global {
  // dev 热更新会重新执行模块，连接池挂在 globalThis 上复用，不会越开越多。
  var __kyselyPool: Pool | undefined;
}

function createPool() {
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });
  // 闲置的连接断开时连接池发出 error，不监听的话在 Next 之外是未捕获的异常；连接池会丢掉这条连接，下次查询新建。
  pool.on("error", (error) => console.error("Database pool error", error));
  return pool;
}

/**
 * 应用数据库（`DATABASE_URL`）的 Kysely 实例，进程内共用一个 pg 连接池。`TDatabase` 只描述调用方拥有的表：
 * 多个 feature 共用一个库时，各自用自己的表类型调用它，得到的是同一个连接池上的不同类型视图。
 * pg 把 int8（`count()`、bigint 列）返回成字符串，以免超出 Number 的精度；表类型照实写成 string，需要数字的地方
 * 在数据层的映射里转换。
 * Kysely 实例本身不持有连接，每次调用新建一个开销很小。
 */
export function getDb<TDatabase>(): Kysely<TDatabase> {
  const pool = (globalThis.__kyselyPool ??= createPool());
  return new Kysely<TDatabase>({ dialect: new PostgresDialect({ pool }) });
}

/** 应用数据库的一条专用连接，不进连接池，给 LISTEN 这类要独占一条连接的用途。调用方负责 connect 和 end。 */
export function createDedicatedClient() {
  return new Client({ connectionString: env.DATABASE_URL });
}

interface LeaderIntervalOptions {
  /** `pg_try_advisory_lock` 的 key。同一个库上用同一个 key 的进程里只有一个在运行 `run`。 */
  lockKey: number;
  intervalMs: number;
  run: () => Promise<void>;
}

/**
 * 每隔 `intervalMs` 运行一次 `run`，但同一个库上同时只有一个进程在运行：每个进程用一条专用连接尝试拿
 * session 级的 advisory lock，拿到的进程一直持有它；进程退出或连接断开时锁自动释放，其他进程在下一轮接手。
 * 不能用连接池里的连接拿锁：session 级的锁属于那条连接，连接还回池里后会被别的查询借走。
 * 上一轮还没结束时跳过这一轮，不会叠加运行。返回停止函数。
 */
export function startLeaderInterval({
  lockKey,
  intervalMs,
  run,
}: LeaderIntervalOptions): () => Promise<void> {
  let client: Client | null = null;
  let leader = false;
  let running = false;

  async function dropClient() {
    const current = client;
    client = null;
    leader = false;
    await current?.end().catch(() => {});
  }

  async function tick() {
    if (!leader) {
      if (!client) {
        const next = createDedicatedClient();
        // 连接断开时 pg 发出 error 事件，不监听会让进程退出；断开后锁已释放，下一轮重新连接、重新竞争。
        next.on("error", () => void dropClient());
        await next.connect();
        client = next;
      }
      const { rows } = await client.query<{ locked: boolean }>(
        "select pg_try_advisory_lock($1) as locked",
        [lockKey],
      );
      leader = rows[0]?.locked === true;
    }
    if (leader) await run();
  }

  const timer = setInterval(() => {
    if (running) return;
    running = true;
    tick()
      .catch((error: unknown) => {
        console.error("Leader interval failed", error);
        return dropClient();
      })
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  timer.unref();

  return async () => {
    clearInterval(timer);
    await dropClient();
  };
}
