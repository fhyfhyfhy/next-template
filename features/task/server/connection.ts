import "server-only";
import type { Kysely } from "kysely";

import { createDb } from "@/lib/db";
import { env } from "@/lib/env";

import type { TaskTables } from "./tables";

export function getTaskDb() {
  return createDb<TaskTables>(env.DATABASE_URL);
}

/**
 * 调用方的数据库连接或事务。多个 feature 共用一个数据库，调用方传来的是它自己的表类型视图，
 * 指向同一个连接，这里按本 feature 的表类型使用。
 */
export type Executor = Pick<Kysely<unknown>, "isTransaction">;

export function taskDb(executor: Executor): Kysely<TaskTables> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- 调用方的表类型视图和本 feature 的视图指向同一个连接或事务，Kysely 的类型参数只描述表，不影响运行时。
  return executor as unknown as Kysely<TaskTables>;
}
