import "server-only";

import { createDb } from "@/lib/db";
import { env } from "@/lib/env";
import {
  createObjectStorage,
  type ObjectStorage,
  type ObjectStorageConfig,
} from "@/lib/object-storage";

import type { UploadTables } from "./tables";

// Demo backend 的连接参数只由 demo:* 命令写进环境变量（scripts/demo-backend/datasets.mjs），值指向 compose.demo.yaml
// 里的服务。Demo backend 没有启用时这里取不到参数、直接抛错：`createUploadAction` 靠它拒绝执行，demo-task 的页面、
// Route Handler 和 Server Action 在调用这个 feature 之前已经检查过 DEMO_DATABASE_URL。

const NOT_ENABLED =
  "The Demo backend is not enabled; run the Demo with pnpm demo:dev";

export function uploadDatabaseUrl() {
  const url = env.DEMO_DATABASE_URL;
  if (url === undefined) throw new Error(NOT_ENABLED);
  return url;
}

export function getUploadDb() {
  return createDb<UploadTables>(uploadDatabaseUrl());
}

export function uploadStorageConfig(): ObjectStorageConfig {
  const {
    DEMO_STORAGE_ENDPOINT: endpoint,
    DEMO_STORAGE_PUBLIC_URL: publicUrl,
    DEMO_STORAGE_BUCKET: bucket,
    DEMO_STORAGE_ACCESS_KEY_ID: accessKeyId,
    DEMO_STORAGE_SECRET_ACCESS_KEY: secretAccessKey,
  } = env;
  if (
    endpoint === undefined ||
    publicUrl === undefined ||
    bucket === undefined ||
    accessKeyId === undefined ||
    secretAccessKey === undefined
  ) {
    throw new Error(NOT_ENABLED);
  }
  return { endpoint, publicUrl, bucket, accessKeyId, secretAccessKey };
}

let storage:
  { endpoint: string; bucket: string; instance: ObjectStorage } | undefined;

export function getUploadStorage(): ObjectStorage {
  const config = uploadStorageConfig();
  const { endpoint, bucket } = config;
  if (storage?.endpoint !== endpoint || storage.bucket !== bucket) {
    storage = { endpoint, bucket, instance: createObjectStorage(config) };
  }
  return storage.instance;
}
