import "server-only";
import { Kysely, PostgresDialect } from "kysely";
import { Client, Pool, types } from "pg";

// pg 默认把 int8（count()、bigserial）解析成字符串，以免超出 Number 的精度。本项目的计数和序号都远小于
// 2^53，统一解析成 number；全进程生效，所以放在这里而不是某个调用方。
types.setTypeParser(types.builtins.INT8, (value) => Number(value));

declare global {
  // dev 热更新会重新执行模块，连接池挂在 globalThis 上，按连接串复用，不会越开越多。
  var __kyselyPools: Map<string, Pool> | undefined;
}

/**
 * 按连接串取一个 Kysely 实例，同一个连接串在进程内共用一个 pg 连接池。`TDatabase` 只描述调用方拥有的表：
 * 多个 feature 共用一个库时，各自用自己的表类型调用它，得到的是同一个连接池上的不同类型视图。
 * Kysely 实例本身不持有连接，每次调用新建一个开销很小。
 */
export function createDb<TDatabase>(
  connectionString: string,
): Kysely<TDatabase> {
  const pools = (globalThis.__kyselyPools ??= new Map());
  let pool = pools.get(connectionString);
  if (!pool) {
    pool = new Pool({ connectionString, max: 10 });
    pools.set(connectionString, pool);
  }
  return new Kysely<TDatabase>({ dialect: new PostgresDialect({ pool }) });
}

interface LeaderIntervalOptions {
  connectionString: string;
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
  connectionString,
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
        const next = new Client({ connectionString });
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
