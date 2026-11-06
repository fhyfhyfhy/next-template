import "server-only";

import { attachUpload, saveServerUpload } from "@/features/upload/server";
import { startLeaderInterval } from "@/lib/db";

import { TASK_STEP_INTERVAL_MS } from "../constants/task-rules";
import { nextTaskStep } from "../utils/task-progress";
import { getTaskDb } from "./connection";
import { cubeGlb } from "./generated-files";
import { notifyTaskChanged } from "./task-events";
import { findTaskRow, toTask } from "./tasks";

// generator：模拟一个外部的生成服务，只有它推进任务。业务读写的代码不碰推进逻辑。

// 和上传清理、写种子数据的 advisory lock 用不同的 key。
const GENERATOR_LOCK_KEY = 2_026_110_201;

/**
 * 把任务推进一步（规则见 utils/task-progress.ts），写入这一步的日志；进入 done 时产出模型文件并关联到任务。
 * 已在终态的任务不变。提交时通知正在推送这个任务日志的 SSE 连接。任务不存在时 404。
 */
export async function advanceTask(taskId: string) {
  const row = await getTaskDb()
    .transaction()
    .execute(async (trx) => {
      const task = await findTaskRow(trx, taskId, { forUpdate: true });
      const step = nextTaskStep(task);
      if (!step) return task;
      const updated = await trx
        .updateTable("tasks")
        .set({
          status: step.status,
          progress: step.progress,
          updated_at: new Date(),
        })
        .where("id", "=", taskId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx
        .insertInto("task_logs")
        .values({ task_id: taskId, line: step.log })
        .execute();
      if (step.status === "done") {
        // 上传记录不随这个事务回滚，回滚时由 upload 的清理任务删除（saveServerUpload）。
        const uploadId = await saveServerUpload({
          purpose: "task-model",
          contentType: "model/gltf-binary",
          body: cubeGlb(),
        });
        await attachUpload(
          {
            uploadId,
            purpose: "task-model",
            recordType: "task",
            recordId: taskId,
            name: "model",
          },
          trx,
        );
      }
      await notifyTaskChanged(trx, taskId);
      return updated;
    });
  return toTask(row);
}

/** 把所有 pending 和 running 的任务各推进一步。 */
export async function advanceActiveTasks() {
  const tasks = await getTaskDb()
    .selectFrom("tasks")
    .select("id")
    .where("status", "in", ["pending", "running"])
    .execute();
  for (const { id } of tasks) {
    try {
      await advanceTask(id);
    } catch (error) {
      // 推进期间任务可能刚被删除，跳过它，不影响其他任务。
      console.error(`Generator could not advance task ${id}`, error);
    }
  }
}

/** 在后台定期推进任务，同一个数据库上只有一个进程在推进（`startLeaderInterval`）。返回停止函数。 */
export function startTaskGenerator({
  intervalMs = TASK_STEP_INTERVAL_MS,
}: { intervalMs?: number } = {}) {
  return startLeaderInterval({
    lockKey: GENERATOR_LOCK_KEY,
    intervalMs,
    run: advanceActiveTasks,
  });
}
