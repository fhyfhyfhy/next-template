import "server-only";
import type { Kysely } from "kysely";

import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { createObjectStorage, type ObjectStorage } from "@/lib/object-storage";

import type { UploadTables } from "./tables";

export function getUploadDb() {
  return getDb<UploadTables>();
}

/**
 * 调用方的数据库连接或事务。多个 feature 共用一个数据库，调用方传来的是它自己的表类型视图，
 * 指向同一个连接，这里按本 feature 的表类型使用。
 */
export type Executor = Pick<Kysely<unknown>, "isTransaction">;

export function uploadDb(executor?: Executor): Kysely<UploadTables> {
  if (!executor) return getUploadDb();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- 调用方的表类型视图和本 feature 的视图指向同一个连接或事务，Kysely 的类型参数只描述表，不影响运行时。
  return executor as unknown as Kysely<UploadTables>;
}

let storage: ObjectStorage | undefined;

/** 按环境变量 `STORAGE_*` 连接对象存储，进程内共用一个 client。 */
export function getUploadStorage(): ObjectStorage {
  storage ??= createObjectStorage({
    endpoint: env.STORAGE_ENDPOINT,
    publicUrl: env.STORAGE_PUBLIC_URL,
    bucket: env.STORAGE_BUCKET,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
  });
  return storage;
}
