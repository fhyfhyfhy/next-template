import { describe, expect, test } from "vitest";

import { cleanupUnattachedUploads } from "./cleanup";
import {
  clearUploadsBeforeEach,
  cover,
  coverUrl,
  rejection,
  upload,
} from "./db-test-helpers";
import { attachUpload, detachRecordUploads } from "./uploads";

clearUploadsBeforeEach();

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
