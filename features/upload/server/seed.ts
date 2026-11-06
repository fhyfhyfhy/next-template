import "server-only";

import { UPLOAD_KEY_PREFIX } from "../constants/storage-keys";
import { type Executor, getUploadStorage, uploadDb } from "./connection";

// 种子数据和数据库测试的重置用到的上传操作，生产代码不调用它们。经 features/upload/seed.ts 导出。

export interface SeedUpload {
  id: string;
  /** 以 `SEED_KEY_PREFIX` 开头。 */
  key: string;
  purpose: string;
  contentType: string;
  body: Uint8Array;
  /** 种子数据里使用这个文件的记录。 */
  attachment: { recordType: string; recordId: string; name: string };
}

// 数据库测试每个用例都恢复一次种子数据；种子文件内容固定，同一个进程只往存储里写一次。
let seedFilesWritten = false;

/**
 * 恢复种子数据里的文件和它们的关联：记录写进数据库，对象写进存储（每个进程只写一次）。
 * 种子文件内容固定，不经过关联时的存储核对。记录已经存在时跳过：任务被删光后，解除了关联的种子上传要等
 * 清理任务过了期限才删，这期间重新写种子数据不能因此失败。
 */
export async function restoreSeedUploads(
  uploads: readonly SeedUpload[],
  executor?: Executor,
) {
  if (!seedFilesWritten) {
    const storage = getUploadStorage();
    await Promise.all(
      uploads.map((upload) =>
        storage.put(upload.key, upload.body, upload.contentType),
      ),
    );
    seedFilesWritten = true;
  }
  if (uploads.length === 0) return;
  const db = uploadDb(executor);
  await db
    .insertInto("uploads")
    .values(
      uploads.map((upload) => ({
        id: upload.id,
        key: upload.key,
        purpose: upload.purpose,
        content_type: upload.contentType,
        size: upload.body.byteLength,
      })),
    )
    .onConflict((conflict) => conflict.doNothing())
    .execute();
  await db
    .insertInto("upload_attachments")
    .values(
      uploads.map(({ id, attachment }) => ({
        upload_id: id,
        record_type: attachment.recordType,
        record_id: attachment.recordId,
        name: attachment.name,
      })),
    )
    .onConflict((conflict) => conflict.doNothing())
    .execute();
}

/**
 * 删除所有上传记录和关联，以及存储里 `UPLOAD_KEY_PREFIX` 下的全部文件（种子文件不在这个前缀下），给数据库测试的
 * 重置用，之后由调用方恢复种子数据。文件按前缀列出来删，没有记录对应的文件也一起删掉。
 * 文件在调用方的事务提交后再删（返回的函数），事务回滚时文件还在。
 */
export async function clearUploads(
  executor?: Executor,
): Promise<() => Promise<void>> {
  const db = uploadDb(executor);
  await db.deleteFrom("upload_attachments").execute();
  await db.deleteFrom("uploads").execute();
  return async () => {
    const storage = getUploadStorage();
    await storage.delete(await storage.list(UPLOAD_KEY_PREFIX));
  };
}
