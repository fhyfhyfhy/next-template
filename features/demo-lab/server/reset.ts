import "server-only";

import { resetFaults } from "@/features/demo-faults/server";
import {
  ensureDemoSeeded,
  lockDemoData,
  resetTasks,
} from "@/features/demo-task/server";
import { clearUploads } from "@/features/demo-upload/server";
import { createDb } from "@/lib/db";
import { demoDatabaseUrl } from "@/lib/demo-backend";

/**
 * 把整个 Demo 恢复成种子数据：清除故障和调用记录、默认延迟恢复成 500 ms（demo-faults），清空上传（demo-upload），
 * 任务、评论和日志恢复成种子数据（demo-task）。三者在一个事务里提交，拿 demo-task 写种子用的锁，和第一次写种子
 * 依次执行。传了 `paused` 时同时设置时钟；不传时保持当前状态：e2e 暂停时钟后，从故障实验室重置也不会让它重新走。
 */
export async function resetDemo({ paused }: { paused?: boolean } = {}) {
  await ensureDemoSeeded();
  // demo-lab 没有自己的表，事务只是三个 feature 共用的连接；各 feature 按自己的表类型使用它。
  const deleteFiles = await createDb<Record<string, never>>(demoDatabaseUrl())
    .transaction()
    .execute(async (trx) => {
      await lockDemoData(trx);
      await resetFaults(trx);
      const deleteUploadFiles = await clearUploads(trx);
      await resetTasks(trx, { paused });
      return deleteUploadFiles;
    });
  await deleteFiles();
}
