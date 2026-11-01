import { beforeEach, describe, expect, test } from "vitest";

import { DomainError, ErrorCode } from "@/lib/domain-error";

import { UPLOAD_ALREADY_USED, UPLOAD_NOT_READY } from "./constants/error-codes";
import {
  attachUpload,
  cleanupUnattachedUploads,
  clearUploads,
  createUpload,
  detachRecordUploads,
  getAttachedUploadUrls,
} from "./server";

// 上传的数据层，经 server.ts 入口调用，连接真实的 Postgres 和对象存储（pnpm demo:test）。
// 记录用的是不透明的 record_type、record_id：这个 feature 不知道业务表，测试里也不需要真实的任务。

beforeEach(async () => {
  const deleteFiles = await clearUploads();
  await deleteFiles();
});

const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

async function rejection(promise: Promise<unknown>) {
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
async function upload(
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

const cover = (recordId: string, uploadId: string) => ({
  uploadId,
  purpose: "task-cover",
  recordType: "note",
  recordId,
  name: "cover",
});

async function coverUrl(recordId: string) {
  return (await getAttachedUploadUrls("note", [recordId], "cover")).get(
    recordId,
  );
}

describe("签发上传", () => {
  test("按用途的规则校验声明的类型和大小，不合格时按参数错误拒绝", async () => {
    const request = {
      purpose: "task-cover",
      contentType: "image/png",
      size: 10,
    };
    expect(
      await rejection(createUpload({ ...request, purpose: "avatar" })),
    ).toMatchObject({
      status: 400,
      code: ErrorCode.BAD_REQUEST,
      param: "purpose",
    });
    expect(
      (await rejection(createUpload({ ...request, contentType: "text/plain" })))
        .param,
    ).toBe("contentType");
    expect(
      await rejection(createUpload({ ...request, size: 5 * 1024 * 1024 + 1 })),
    ).toMatchObject({ param: "size", params: { max: 5 * 1024 * 1024 } });
    expect((await rejection(createUpload({ ...request, size: 0 }))).param).toBe(
      "size",
    );
  });

  test("上传 URL 只接受签发时声明的类型和大小", async () => {
    const { uploadUrl } = await upload(null);
    const wrongType = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/gif" },
      body: PNG,
    });
    const wrongSize = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: new Uint8Array(PNG.byteLength + 1),
    });
    expect([wrongType.status, wrongSize.status]).toStrictEqual([403, 403]);
  });
});

describe("关联", () => {
  test("关联后可以按记录查到文件的公开地址，地址能直接读取", async () => {
    const { id } = await upload();
    await attachUpload(cover("n1", id));

    const url = await coverUrl("n1");
    const response = await fetch(url ?? "");
    expect(new Uint8Array(await response.arrayBuffer())).toStrictEqual(PNG);
  });

  test("文件还没传到存储时按 UPLOAD_NOT_READY 拒绝", async () => {
    const { id } = await upload(null);
    expect(await rejection(attachUpload(cover("n1", id)))).toMatchObject({
      status: 409,
      code: UPLOAD_NOT_READY,
    });
  });

  test("重复提交同一个关联什么也不做，同一次上传给另一条记录用时按 UPLOAD_ALREADY_USED 拒绝", async () => {
    const { id } = await upload();
    await attachUpload(cover("n1", id));
    await attachUpload(cover("n1", id));

    expect((await rejection(attachUpload(cover("n2", id)))).code).toBe(
      UPLOAD_ALREADY_USED,
    );
  });

  test("用途和签发时不一致、上传不存在时拒绝", async () => {
    const { id } = await upload();
    expect(
      (
        await rejection(
          attachUpload({ ...cover("n1", id), purpose: "task-model" }),
        )
      ).param,
    ).toBe("uploadId");
    expect((await rejection(attachUpload(cover("n1", "missing")))).status).toBe(
      404,
    );
  });

  test("记录换用新文件后，查到的是新文件的地址", async () => {
    const first = await upload();
    const second = await upload();
    await attachUpload(cover("n1", first.id));
    const before = await coverUrl("n1");
    await attachUpload(cover("n1", second.id));

    const after = await coverUrl("n1");
    expect(after).not.toBe(before);
    expect(after).toContain(second.id);
  });
});

describe("清理没被使用的上传", () => {
  test("删除过了等待时间、没被任何记录使用的上传和文件，正在使用的保留", async () => {
    const used = await upload();
    const unused = await upload();
    await attachUpload(cover("n1", used.id));

    expect(await cleanupUnattachedUploads(0)).toBe(1);

    expect((await fetch(unused.uploadUrl.split("?")[0])).status).not.toBe(200);
    expect((await rejection(attachUpload(cover("n2", unused.id)))).status).toBe(
      404,
    );
    expect((await fetch((await coverUrl("n1")) ?? "")).status).toBe(200);
  });

  test("还没过等待时间的上传不删，正在上传的文件不受影响", async () => {
    await upload();
    expect(await cleanupUnattachedUploads()).toBe(0);
  });

  test("记录解除关联、换下来的旧文件在下一次清理时删除", async () => {
    const first = await upload();
    const second = await upload();
    await attachUpload(cover("n1", first.id));
    await attachUpload(cover("n1", second.id));
    await attachUpload(cover("n2", (await upload()).id));
    await detachRecordUploads("note", "n2");

    expect(await cleanupUnattachedUploads(0)).toBe(2);
    expect(await coverUrl("n1")).toContain(second.id);
    expect(await coverUrl("n2")).toBeUndefined();
  });
});
