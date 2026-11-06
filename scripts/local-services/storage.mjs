import { S3Client } from "@aws-sdk/client-s3";

import { STORAGE } from "./datasets.mjs";

/**
 * 连本地对象存储（compose.yaml）的 S3 client，本地服务的脚本和 e2e 共用这套选项；用完调用 `destroy()`。
 * 选项的原因见 lib/object-storage.ts 的 `createObjectStorage`。
 */
export function createLocalStorageClient() {
  return new S3Client({
    endpoint: STORAGE.endpoint,
    region: "us-east-1",
    credentials: {
      accessKeyId: STORAGE.accessKeyId,
      secretAccessKey: STORAGE.secretAccessKey,
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}
