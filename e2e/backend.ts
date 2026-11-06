import { randomUUID } from "node:crypto";
import {
  Kysely,
  PostgresDialect,
  type QueryExecutorProvider,
  sql,
} from "kysely";
import pg from "pg";

import { localEnv } from "../scripts/local-services/datasets.mjs";
import { createLocalStorageClient } from "../scripts/local-services/storage.mjs";

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

/** 名称后面接一段随机串：用例之间、复用服务多跑几轮时都不会撞名，也不会被别的用例的搜索搜到。 */
export function unique(label: string) {
  return `${label} ${randomUUID().slice(0, 6)}`;
}
