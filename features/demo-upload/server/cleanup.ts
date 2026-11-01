import "server-only";
import { DatabaseError } from "pg";

import { startLeaderInterval } from "@/lib/db";

import { getUploadDb, getUploadStorage } from "./connection";
import { SEED_KEY_PREFIX } from "./uploads";

/**
 * 上传创建多久之后仍没被任何记录使用，就当作没人要了。必须远长于上传 URL 的有效期（uploads.ts 的
 * UPLOAD_URL_TTL_SECONDS）加上用户完成上传和关联的时间，否则会删掉正在上传、还没来得及关联的文件。
 */
export const UNATTACHED_UPLOAD_TTL_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
// 和 Demo 生成器的锁（demo-task）用不同的 key：两个后台任务各自选出运行的进程。
const CLEANUP_LOCK_KEY = 2_026_110_202;

/**
 * 删除创建超过 `olderThanMs`、而且没有被任何记录使用的上传：先删记录，再删存储里的对象。这是删除上传文件的
 * 唯一路径：上传了没用上的、换下来的旧封面、被删除任务的文件，都等到这里删。种子文件的对象保留
 * （见 SEED_KEY_PREFIX）。返回删除的上传数。
 */
export async function cleanupUnattachedUploads(
  olderThanMs = UNATTACHED_UPLOAD_TTL_MS,
): Promise<number> {
  const db = getUploadDb();
  const candidates = await db
    .selectFrom("uploads")
    .select(["id", "key"])
    .where("created_at", "<", new Date(Date.now() - olderThanMs))
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom("upload_attachments")
            .select("upload_id")
            .whereRef("upload_attachments.upload_id", "=", "uploads.id"),
        ),
      ),
    )
    .execute();
  const deletedKeys: string[] = [];
  for (const candidate of candidates) {
    try {
      // 逐条删除：查询之后可能刚好有一次关联用上了它，外键会让这条删除失败，跳过即可。
      const deleted = await db
        .deleteFrom("uploads")
        .where("id", "=", candidate.id)
        .executeTakeFirst();
      if (Number(deleted.numDeletedRows) > 0) deletedKeys.push(candidate.key);
    } catch (error) {
      if (!(error instanceof DatabaseError && error.code === "23503")) {
        throw error;
      }
    }
  }
  await getUploadStorage().delete(
    deletedKeys.filter((key) => !key.startsWith(SEED_KEY_PREFIX)),
  );
  return deletedKeys.length;
}

/** 在后台定期清理，同一个 Demo 数据库上只有一个进程在清理（`startLeaderInterval`）。返回停止函数。 */
export function startUploadCleanup() {
  return startLeaderInterval({
    connectionString: process.env.DEMO_DATABASE_URL ?? "",
    lockKey: CLEANUP_LOCK_KEY,
    intervalMs: CLEANUP_INTERVAL_MS,
    run: async () => {
      await cleanupUnattachedUploads();
    },
  });
}
