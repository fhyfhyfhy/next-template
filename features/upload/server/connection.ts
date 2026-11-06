import "server-only";

import { createDb } from "@/lib/db";
import { env } from "@/lib/env";
import { createObjectStorage, type ObjectStorage } from "@/lib/object-storage";

import type { UploadTables } from "./tables";

export function getUploadDb() {
  return createDb<UploadTables>(env.DATABASE_URL);
}

let storage:
  { endpoint: string; bucket: string; instance: ObjectStorage } | undefined;

/** 按环境变量连接对象存储；数据库测试会在同一个进程里换 bucket，换了就重新创建。 */
export function getUploadStorage(): ObjectStorage {
  const endpoint = env.STORAGE_ENDPOINT;
  const bucket = env.STORAGE_BUCKET;
  if (storage?.endpoint !== endpoint || storage.bucket !== bucket) {
    storage = {
      endpoint,
      bucket,
      instance: createObjectStorage({
        endpoint,
        publicUrl: env.STORAGE_PUBLIC_URL,
        bucket,
        accessKeyId: env.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
      }),
    };
  }
  return storage.instance;
}
