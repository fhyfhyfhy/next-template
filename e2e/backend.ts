import {
  Kysely,
  PostgresDialect,
  type QueryExecutorProvider,
  sql,
} from "kysely";
import { nanoid } from "nanoid";
import pg from "pg";

import { localEnv } from "../scripts/local-services/datasets.mjs";
import { createLocalStorageClient } from "../scripts/local-services/storage.mjs";
import { expect } from "./test";

// 用例的测试数据直接写进 e2e 数据集（playwright.config.ts 的 webServer 用的同一个库），不经过应用。这里是和业务无关的
// 部分；按项目的表写数据的 fixture 建在它上面。

const E2E_ENV = localEnv("e2e");
const E2E_DATABASE_URL = E2E_ENV.DATABASE_URL;

/** 连到 e2e 数据集。`Tables` 只描述调用方用到的表和列；用完调用 `destroy()`。 */
export function connectE2eDatabase<Tables>() {
  return new Kysely<Tables>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: E2E_DATABASE_URL, max: 2 }),
    }),
  });
}

/** 连到 e2e 数据集的 bucket；用完调用 `client.destroy()`。 */
export function connectE2eStorage() {
  return {
    bucket: E2E_ENV.STORAGE_BUCKET,
    client: createLocalStorageClient(),
  };
}

/** 在写入的事务里发一条 Postgres NOTIFY，和应用的后台任务写入时一样通知监听这个频道的连接。 */
export function notify(
  trx: QueryExecutorProvider,
  channel: string,
  payload: string,
) {
  return sql`select pg_notify(${channel}, ${payload})`.execute(trx);
}

/**
 * 锁住一张表，直到调用返回的函数：服务端对这张表的读取一直等着，用来拖慢页面里的某一段数据。
 * 用自己的连接拿锁，不占连接池。
 */
export async function holdTable(table: string) {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  await client.query("begin");
  await client.query(`lock table ${pg.escapeIdentifier(table)}`);
  return async () => {
    await client.query("rollback");
    await client.end();
  };
}

/**
 * 让 `act` 引起的服务端读取 `table` 失败，像读数据时数据库出错：锁住这张表，执行 `act`（比如打开页面、点重试），
 * 取消等锁的读取，再释放锁。服务端可能在 `act` 返回之后才发出读取，所以轮询到取消了一个为止。
 */
export async function failServerRead(
  table: string,
  act: () => Promise<unknown>,
) {
  const release = await holdTable(table);
  try {
    await act();
    await expect.poll(() => failQueriesWaitingFor(table)).toBeGreaterThan(0);
  } finally {
    await release();
  }
}

/** 取消服务端正在等 `holdTable(table)` 锁的查询，返回取消了几个；查询还没发出时是 0。 */
async function failQueriesWaitingFor(table: string) {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ cancelled: boolean }>(
      `select pg_cancel_backend(pid) as cancelled
       from pg_stat_activity
       where datname = current_database()
         and wait_event_type = 'Lock'
         and query like $1`,
      [`%"${table}"%`],
    );
    return rows.filter((row) => row.cancelled).length;
  } finally {
    await client.end();
  }
}

/** 名称后面接一段随机串：用例之间、复用服务多跑几轮时都不会撞名，也不会被别的用例的搜索搜到。 */
export function unique(label: string) {
  return `${label} ${nanoid(6)}`;
}
