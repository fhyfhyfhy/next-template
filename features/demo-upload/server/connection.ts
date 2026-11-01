import "server-only";

import { createDb } from "@/lib/db";
import { createObjectStorage, type ObjectStorage } from "@/lib/object-storage";

import type { UploadTables } from "./tables";

// Demo 后端的连接参数只由 demo:* 命令写进环境变量（scripts/demo-backend/datasets.mjs），值指向 compose.demo.yaml
// 里的服务。调用到这里时 Demo 后端一定已经启用：页面、Route Handler 和 Server Action 先检查了 DEMO_DATABASE_URL。

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set; run the Demo with pnpm demo:dev`);
  }
  return value;
}

export function getUploadDb() {
  return createDb<UploadTables>(requireEnv("DEMO_DATABASE_URL"));
}

let storage:
  { endpoint: string; bucket: string; instance: ObjectStorage } | undefined;

export function getUploadStorage(): ObjectStorage {
  const endpoint = requireEnv("DEMO_STORAGE_ENDPOINT");
  const bucket = requireEnv("DEMO_STORAGE_BUCKET");
  if (storage?.endpoint !== endpoint || storage.bucket !== bucket) {
    storage = {
      endpoint,
      bucket,
      instance: createObjectStorage({
        endpoint,
        bucket,
        publicUrl: requireEnv("DEMO_STORAGE_PUBLIC_URL"),
        accessKeyId: requireEnv("DEMO_STORAGE_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("DEMO_STORAGE_SECRET_ACCESS_KEY"),
      }),
    };
  }
  return storage.instance;
}
