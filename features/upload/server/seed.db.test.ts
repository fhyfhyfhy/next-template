import { describe, expect, test } from "vitest";

import { SEED_KEY_PREFIX } from "../constants/storage-keys";
import {
  clearUploadsBeforeEach,
  cover,
  coverUrl,
  PNG,
  upload,
} from "./db-test-helpers";
import { clearUploads, restoreSeedUploads, type SeedUpload } from "./seed";
import { attachUpload } from "./uploads";

clearUploadsBeforeEach();

const seedCover = (recordId: string): SeedUpload => ({
  id: `seed-test-cover-${recordId}`,
  key: `${SEED_KEY_PREFIX}test/${recordId}.png`,
  purpose: "task-cover",
  contentType: "image/png",
  body: PNG,
  attachment: { recordType: "note", recordId, name: "cover" },
});

describe("恢复种子上传", () => {
  test("写入记录和关联，种子文件可以直接读取", async () => {
    await restoreSeedUploads([seedCover("n1")]);

    const url = (await coverUrl("n1")) ?? "";
    expect(url).toContain(`/${SEED_KEY_PREFIX}test/n1.png`);
    expect((await fetch(url)).status).toBe(200);
  });

  test("记录和关联已经存在时跳过，不报错", async () => {
    await restoreSeedUploads([seedCover("n1")]);

    await restoreSeedUploads([seedCover("n1")]);

    expect(await coverUrl("n1")).toContain(`/${SEED_KEY_PREFIX}test/n1.png`);
  });
});

describe("清空上传", () => {
  test("清空上传记录和 uploads/ 下的全部文件", async () => {
    const { id } = await upload();
    await attachUpload(cover("n1", id));
    const url = (await coverUrl("n1")) ?? "";
    expect((await fetch(url)).status).toBe(200);

    const deleteFiles = await clearUploads();
    await deleteFiles();

    expect(await coverUrl("n1")).toBeUndefined();
    expect((await fetch(url)).status).not.toBe(200);
  });

  test("种子文件不在 uploads/ 下，清空后仍然可以读取", async () => {
    await restoreSeedUploads([seedCover("n1")]);
    const url = (await coverUrl("n1")) ?? "";

    const deleteFiles = await clearUploads();
    await deleteFiles();

    expect((await fetch(url)).status).toBe(200);
  });
});
