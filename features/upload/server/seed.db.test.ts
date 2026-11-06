import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";

import { SEED_KEY_PREFIX } from "../constants/storage-keys";
import { getUploadStorage } from "./connection";
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

// 种子文件不在 clearUploads 清空的前缀下，test 数据集的 bucket 也不在运行之间清空：每次运行用自己的路径，
// 上次留下的文件不会让读取的断言白过，运行结束时删掉。
const RUN_PATH = `test/${randomUUID()}/`;
const RUN_PREFIX = `${SEED_KEY_PREFIX}${RUN_PATH}`;

afterAll(async () => {
  const storage = getUploadStorage();
  await storage.delete(await storage.list(RUN_PREFIX));
});

const seedCover = (recordId: string): SeedUpload => ({
  id: `seed-test-cover-${recordId}`,
  path: `${RUN_PATH}${recordId}.png`,
  purpose: "task-cover",
  contentType: "image/png",
  body: PNG,
  attachment: { recordType: "note", recordId, name: "cover" },
});

describe("恢复种子上传", () => {
  test("写入记录和关联，种子文件可以直接读取", async () => {
    await restoreSeedUploads([seedCover("n1")]);

    const url = (await coverUrl("n1")) ?? "";
    expect(url).toContain(`/${RUN_PREFIX}n1.png`);
    expect((await fetch(url)).status).toBe(200);
  });

  test("记录和关联已经存在时跳过，不报错", async () => {
    await restoreSeedUploads([seedCover("n1")]);

    await restoreSeedUploads([seedCover("n1")]);

    expect(await coverUrl("n1")).toContain(`/${RUN_PREFIX}n1.png`);
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
