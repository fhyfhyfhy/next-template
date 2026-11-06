import "server-only";
import { type Kysely, sql } from "kysely";

import {
  restoreSeedUploads,
  SEED_KEY_PREFIX,
  type SeedUpload,
} from "@/features/upload/server";

import type { TaskStatus } from "../types/task-filters";
import { type Executor, getTaskDb, taskDb } from "./connection";
import { cubeGlb, generatedCoverSvg } from "./generated-files";
import type { TaskTables } from "./tables";

// 本地开发和测试用的种子数据：pnpm dev 在本地库还没有任务时写入（scripts/local-services/seed.mjs），pnpm db:reset、
// e2e 和数据库测试恢复成它。内容固定不变：id、时间戳都是常量，每次写入后的数据完全相同，e2e 和测试按 id 引用这些任务。

const SEED_EPOCH = Date.UTC(2026, 9, 1);
const HOUR = 60 * 60 * 1000;
// 和 generator、上传清理的锁用不同的 key。
const SEED_LOCK_KEY = 2_026_110_203;

const PROMPTS = {
  fox: "一只低多边形风格的狐狸，坐姿，橙白配色",
  mech: "科幻机甲，金属质感，带发光的能量核心",
  house: "北欧风格的小木屋，雪地，烟囱冒烟",
  sword: "奇幻长剑，符文雕刻，蓝色宝石剑柄",
  car: "复古跑车，圆润车身，薄荷绿车漆",
  plant: "陶土盆里的多肉植物，卡通风格",
};

// 名称、prompt、状态、是否收藏、是否有封面。
const TASKS: [string, keyof typeof PROMPTS, TaskStatus, boolean, boolean][] = [
  ["低多边形狐狸", "fox", "done", true, true],
  ["坐着的狐狸 v2", "fox", "done", false, true],
  ["橙色狐狸草稿", "fox", "running", false, false],
  ["重装机甲", "mech", "done", true, true],
  ["机甲 fail 测试", "mech", "failed", false, false],
  ["侦察机甲", "mech", "done", false, false],
  ["雪地木屋", "house", "done", false, true],
  ["木屋夜景", "house", "done", true, true],
  ["木屋 fail 材质", "house", "failed", false, false],
  ["符文长剑", "sword", "done", false, true],
  ["蓝宝石剑柄", "sword", "pending", false, false],
  ["长剑低模", "sword", "done", false, false],
  ["薄荷绿跑车", "car", "done", true, true],
  ["跑车侧视", "car", "done", false, true],
  ["跑车 fail 轮毂", "car", "failed", false, false],
  ["复古跑车 v3", "car", "running", false, false],
  ["多肉盆栽", "plant", "done", false, true],
  ["卡通多肉", "plant", "done", false, false],
  ["多肉组合", "plant", "pending", false, false],
  ["多肉高模", "plant", "done", false, true],
];

const COMMENTS: [string, string][] = [
  ["task-01", "耳朵的面数可以再少一点，更有低多边形的感觉。"],
  ["task-01", "配色很好，导出给游戏原型用了。"],
  ["task-04", "能量核心的发光能不能单独做一个材质？"],
  ["task-07", "烟囱的烟有点糊，下次试试更短的 prompt。"],
  ["task-13", "车漆颜色正是想要的。"],
];

function seedTasks() {
  return TASKS.map(([name, prompt, status, favorite, hasCover], index) => {
    const createdAt = SEED_EPOCH + index * HOUR;
    return {
      row: {
        id: `task-${String(index + 1).padStart(2, "0")}`,
        name,
        prompt: PROMPTS[prompt],
        status,
        progress: status === "done" ? 100 : status === "running" ? 50 : 0,
        favorite,
        created_at: new Date(createdAt),
        updated_at: new Date(createdAt + (status === "pending" ? 0 : HOUR / 2)),
      },
      hasCover,
    };
  });
}

function seedLogs(status: TaskStatus) {
  if (status === "pending") return [];
  const logs = ["开始生成", "解析 prompt", "生成网格"];
  if (status === "done") logs.push("生成贴图", "生成完成");
  if (status === "failed") logs.push("生成失败：材质计算出错");
  return logs;
}

/** 有封面的种子任务用生成的封面图，done 的种子任务带模型文件；都放在 `SEED_KEY_PREFIX` 前缀下，重置和清理都不删它们。 */
function seedUploads(tasks: ReturnType<typeof seedTasks>): SeedUpload[] {
  const model = cubeGlb();
  return tasks.flatMap(({ row, hasCover }) => [
    ...(hasCover
      ? [
          {
            id: `seed-cover-${row.id}`,
            key: `${SEED_KEY_PREFIX}covers/${row.id}.svg`,
            purpose: "task-cover",
            contentType: "image/svg+xml",
            body: new TextEncoder().encode(generatedCoverSvg(row.id)),
            attachment: { recordType: "task", recordId: row.id, name: "cover" },
          },
        ]
      : []),
    ...(row.status === "done"
      ? [
          {
            id: `seed-model-${row.id}`,
            key: `${SEED_KEY_PREFIX}models/${row.id}.glb`,
            purpose: "task-model",
            contentType: "model/gltf-binary",
            body: model,
            attachment: { recordType: "task", recordId: row.id, name: "model" },
          },
        ]
      : []),
  ]);
}

/** 写入全部种子数据，调用方先清空了任务和上传。 */
async function writeSeed(trx: Kysely<TaskTables>) {
  const tasks = seedTasks();
  await trx
    .insertInto("tasks")
    .values(tasks.map(({ row }) => row))
    .execute();
  await trx
    .insertInto("task_comments")
    .values(
      COMMENTS.map(([taskId, content], index) => ({
        id: `comment-${String(index + 1).padStart(2, "0")}`,
        task_id: taskId,
        content,
        created_at: new Date(SEED_EPOCH + 30 * HOUR + index * HOUR),
      })),
    )
    .execute();
  const logs = tasks.flatMap(({ row }) =>
    seedLogs(row.status).map((line) => ({ task_id: row.id, line })),
  );
  if (logs.length > 0) await trx.insertInto("task_logs").values(logs).execute();
  await restoreSeedUploads(seedUploads(tasks), trx);
}

/**
 * 任务、评论和日志恢复成种子数据，种子任务的封面和模型交给 upload 恢复，所以调用方要先清空上传。
 * 在调用方的事务里执行。
 */
export async function resetTasks(executor: Executor) {
  const trx = taskDb(executor);
  // 评论和日志随外键删除。
  await trx.deleteFrom("tasks").execute();
  await writeSeed(trx);
}

/** 库里还没有任务时写入种子数据。多个进程同时调用时依次执行，只有第一个写入。 */
export async function seedIfEmpty() {
  await getTaskDb()
    .transaction()
    .execute(async (trx) => {
      await sql`select pg_advisory_xact_lock(${SEED_LOCK_KEY})`.execute(trx);
      const existing = await trx
        .selectFrom("tasks")
        .select("id")
        .limit(1)
        .executeTakeFirst();
      if (!existing) await writeSeed(trx);
    });
}
