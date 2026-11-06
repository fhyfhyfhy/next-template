import { beforeEach, expect } from "vitest";

import { DomainError } from "@/lib/domain-error";

import { clearUploads } from "./seed";
import { createUpload, getAttachedUploadUrls } from "./uploads";

// *.db.test.ts 共用的准备和断言。

/** 每个测试从没有任何上传开始。在测试文件的顶层调用。 */
export function clearUploadsBeforeEach() {
  beforeEach(async () => {
    const deleteFiles = await clearUploads();
    await deleteFiles();
  });
}

export const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

export async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof DomainError)) {
    throw new Error(`Expected a DomainError, got ${String(error)}`);
  }
  const { status, code, param, params } = error;
  return { status, code, param, params };
}

/** 签发一次封面上传；`body` 不为 null 时按浏览器的做法直传到对象存储。 */
export async function upload(
  body: Uint8Array<ArrayBuffer> | null = PNG,
  contentType = "image/png",
) {
  const { id, uploadUrl } = await createUpload({
    purpose: "task-cover",
    contentType,
    size: PNG.byteLength,
  });
  if (body) {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body,
    });
    expect(response.status).toBe(200);
  }
  return { id, uploadUrl };
}

// 记录用的是不透明的 record_type、record_id：这个 feature 不知道业务表，测试里也不需要真实的任务。
export const cover = (recordId: string, uploadId: string) => ({
  uploadId,
  purpose: "task-cover",
  recordType: "note",
  recordId,
  name: "cover",
});

export async function coverUrl(recordId: string) {
  return (await getAttachedUploadUrls("note", [recordId], "cover")).get(
    recordId,
  );
}
