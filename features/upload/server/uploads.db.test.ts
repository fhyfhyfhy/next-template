import { describe, expect, test } from "vitest";

import { ErrorCode } from "@/lib/domain-error";

import {
  UPLOAD_ALREADY_USED,
  UPLOAD_NOT_READY,
} from "../constants/error-codes";
import { cover, coverUrl, PNG, rejection, upload } from "./db-test-helpers";
import { attachUpload, createUpload } from "./uploads";

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
