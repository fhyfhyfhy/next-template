import "server-only";
import { type Kysely, type Selectable, sql } from "kysely";
import { nanoid } from "nanoid";
import { DatabaseError } from "pg";
import { cache } from "react";

import {
  attachUpload,
  detachRecordUploads,
  getAttachedUploadDownloadUrl,
  getAttachedUploadUrls,
} from "@/features/demo-upload/server";
import { badRequest, conflict, notFound } from "@/lib/domain-error";

import {
  TASK_NAME_TAKEN,
  TASK_NOT_DONE,
  TASK_NOT_RETRYABLE,
} from "../constants/error-codes";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  SEARCH_LIMIT,
  TASK_NAME_MAX_LENGTH,
  TASK_PROMPT_MAX_LENGTH,
} from "../constants/task-rules";
import type { FeedPage, Task, TaskPage } from "../types/task";
import type { TaskFilters } from "../types/task-filters";
import { decodeFeedCursor, encodeFeedCursor } from "../utils/feed-cursor";
import { containsPattern, requireText } from "../utils/text-rules";
import { getTaskDb } from "./connection";
import { demoOperation } from "./demo-controls";
import type { TasksTable, TaskTables } from "./tables";
import { notifyTaskChanged } from "./task-events";

type TaskRow = Selectable<TasksTable>;

/** 数据库行转成对外的 `Task`；封面地址由 demo-upload 按 `("task", id, "cover")` 查出，一次查一批。 */
async function toTasks(rows: TaskRow[]): Promise<Task[]> {
  const covers = await getAttachedUploadUrls(
    "task",
    rows.map((row) => row.id),
    "cover",
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    status: row.status,
    progress: row.progress,
    favorite: row.favorite,
    coverUrl: covers.get(row.id) ?? null,
    createdAt: row.created_at.getTime(),
    updatedAt: row.updated_at.getTime(),
  }));
}

export async function toTask(row: TaskRow): Promise<Task> {
  const [task] = await toTasks([row]);
  return task;
}

/** 查一行任务，不存在时按 404 拒绝。`forUpdate` 时锁住这一行，调用方在事务里修改它。 */
export async function findTaskRow(
  db: Kysely<TaskTables>,
  id: string,
  { forUpdate = false } = {},
): Promise<TaskRow> {
  let query = db.selectFrom("tasks").selectAll().where("id", "=", id);
  if (forUpdate) query = query.forUpdate();
  const row = await query.executeTakeFirst();
  if (!row) throw notFound(`Task ${id} not found`);
  return row;
}

function clampPageSize(pageSize: number | undefined) {
  return Math.min(Math.max(pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
}

function isUniqueViolation(error: unknown, constraint: string) {
  return (
    error instanceof DatabaseError &&
    error.code === "23505" &&
    error.constraint === constraint
  );
}

function nameTaken(name: string) {
  return conflict(TASK_NAME_TAKEN, `Name "${name}" is already taken`, {
    param: "name",
  });
}

// ---- 读 ----

/** 任务列表：按状态（可多选）、收藏、prompt 过滤，可排除一个任务，页码从 1 开始，超出范围时返回空列表。 */
export const listTasks = cache(
  demoOperation(
    "task.list",
    "read",
    async (filters: TaskFilters): Promise<TaskPage> => {
      const db = getTaskDb();
      const pageSize = clampPageSize(filters.pageSize);
      const page = Math.max(filters.page ?? 1, 1);
      let query = db.selectFrom("tasks");
      if (filters.status && filters.status.length > 0) {
        query = query.where("status", "in", filters.status);
      }
      if (filters.favorite !== undefined) {
        query = query.where("favorite", "=", filters.favorite);
      }
      if (filters.prompt !== undefined) {
        query = query.where("prompt", "=", filters.prompt);
      }
      if (filters.excludeId !== undefined) {
        query = query.where("id", "!=", filters.excludeId);
      }
      const { total } = await query
        .select((eb) => eb.fn.countAll<number>().as("total"))
        .executeTakeFirstOrThrow();
      let rowsQuery = query.selectAll();
      switch (filters.sort) {
        case "created_asc":
          rowsQuery = rowsQuery
            .orderBy("created_at", "asc")
            .orderBy("id", "asc");
          break;
        case "name_asc":
          // 中文按拼音排序；镜像要带 ICU（compose.demo.yaml 的 Postgres 官方镜像带）。
          rowsQuery = rowsQuery
            .orderBy(sql`name collate "zh-x-icu"`)
            .orderBy("id");
          break;
        default:
          rowsQuery = rowsQuery
            .orderBy("created_at", "desc")
            .orderBy("id", "desc");
      }
      const rows = await rowsQuery
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .execute();
      return {
        items: await toTasks(rows),
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      };
    },
  ),
);

export const getTask = cache(
  demoOperation("task.get", "read", async (id: string) =>
    toTask(await findTaskRow(getTaskDb(), id)),
  ),
);

/** 名称或 prompt 包含关键词的任务，不区分大小写，按创建时间倒序，最多 20 条；关键词为空时返回空列表。 */
export const searchTasks = cache(
  demoOperation(
    "task.search",
    "read",
    async (term: string): Promise<Task[]> => {
      const keyword = term.trim();
      if (!keyword) return [];
      const pattern = containsPattern(keyword);
      const rows = await getTaskDb()
        .selectFrom("tasks")
        .selectAll()
        .where((eb) =>
          eb.or([eb("name", "ilike", pattern), eb("prompt", "ilike", pattern)]),
        )
        .orderBy("created_at", "desc")
        .orderBy("id", "desc")
        .limit(SEARCH_LIMIT)
        .execute();
      return toTasks(rows);
    },
  ),
);

/**
 * 作品广场：done 的任务按创建时间倒序，游标分页。下一页取严格排在游标之后的任务，滚动期间有任务完成、
 * 插到前面，也不会让后面的页重复或漏掉。游标解析不了时从第一页开始。
 */
export const listFeed = cache(
  demoOperation(
    "feed.list",
    "read",
    async (cursor: string | null, limit: number): Promise<FeedPage> => {
      const size = clampPageSize(limit);
      let query = getTaskDb()
        .selectFrom("tasks")
        .selectAll()
        .where("status", "=", "done");
      const position = cursor === null ? null : decodeFeedCursor(cursor);
      if (position) {
        query = query.where(
          sql<boolean>`(created_at, id) < (${new Date(position.createdAt)}, ${position.id})`,
        );
      }
      const rows = await query
        .orderBy("created_at", "desc")
        .orderBy("id", "desc")
        .limit(size + 1)
        .execute();
      const items = rows.slice(0, size);
      const last = items.at(-1);
      return {
        items: await toTasks(items),
        nextCursor:
          rows.length > size && last
            ? encodeFeedCursor({
                createdAt: last.created_at.getTime(),
                id: last.id,
              })
            : null,
      };
    },
  ),
);

/** done 任务的模型文件的短期下载地址，文件名是任务名；没完成的任务按 `TASK_NOT_DONE` 拒绝。 */
export const getTaskModelUrl = demoOperation(
  "task.model",
  "read",
  async (id: string) => {
    const task = await findTaskRow(getTaskDb(), id);
    const url =
      task.status === "done"
        ? await getAttachedUploadDownloadUrl(
            "task",
            id,
            "model",
            `${task.name}.glb`,
          )
        : null;
    if (!url) {
      throw conflict(
        TASK_NOT_DONE,
        "The model is available once the task is done",
      );
    }
    return url;
  },
);

// ---- 写 ----
// 每个写操作有两份：`*Record` 直接改数据，故障实验室的控制入口用它模拟“别的客户端改了数据”，不受注入的
// 延迟和故障影响；导出给页面、Route Handler 和 Server Action 的是 demoOperation 包装过的版本。

export async function createTaskRecord(input: {
  name: unknown;
  prompt: unknown;
}) {
  const name = requireText(input.name, "name", TASK_NAME_MAX_LENGTH);
  const prompt = requireText(input.prompt, "prompt", TASK_PROMPT_MAX_LENGTH);
  const now = new Date();
  try {
    const row = await getTaskDb()
      .insertInto("tasks")
      .values({
        id: nanoid(),
        name,
        prompt,
        status: "pending",
        progress: 0,
        favorite: false,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toTask(row);
  } catch (error) {
    if (isUniqueViolation(error, "tasks_name_key")) throw nameTaken(name);
    throw error;
  }
}

export async function renameTaskRecord(id: string, input: { name: unknown }) {
  const name = requireText(input.name, "name", TASK_NAME_MAX_LENGTH);
  try {
    const row = await getTaskDb()
      .updateTable("tasks")
      .set({ name, updated_at: new Date() })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw notFound(`Task ${id} not found`);
    return toTask(row);
  } catch (error) {
    if (isUniqueViolation(error, "tasks_name_key")) throw nameTaken(name);
    throw error;
  }
}

export async function setTaskFavoriteRecord(
  id: string,
  input: { favorite: unknown },
) {
  if (typeof input.favorite !== "boolean") {
    throw badRequest("favorite must be a boolean", { param: "favorite" });
  }
  const row = await getTaskDb()
    .updateTable("tasks")
    .set({ favorite: input.favorite, updated_at: new Date() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
  if (!row) throw notFound(`Task ${id} not found`);
  return toTask(row);
}

/** 只有 failed 的任务能重试：回到 pending，进度归零，日志清空。任务已经不是 failed 时按 `TASK_NOT_RETRYABLE` 拒绝。 */
export async function retryTaskRecord(id: string) {
  const row = await getTaskDb()
    .transaction()
    .execute(async (trx) => {
      const retried = await trx
        .updateTable("tasks")
        .set({ status: "pending", progress: 0, updated_at: new Date() })
        .where("id", "=", id)
        .where("status", "=", "failed")
        .returningAll()
        .executeTakeFirst();
      if (!retried) {
        await findTaskRow(trx, id);
        throw conflict(
          TASK_NOT_RETRYABLE,
          "Only failed tasks can be retried; the task status may have changed",
        );
      }
      await trx.deleteFrom("task_logs").where("task_id", "=", id).execute();
      await notifyTaskChanged(trx, id);
      return retried;
    });
  return toTask(row);
}

/** 删除任务，评论和日志随外键一起删除，封面和模型解除关联，文件留给 demo-upload 的清理任务。 */
export async function deleteTaskRecord(id: string) {
  await getTaskDb()
    .transaction()
    .execute(async (trx) => {
      const deleted = await trx
        .deleteFrom("tasks")
        .where("id", "=", id)
        .returning("id")
        .executeTakeFirst();
      if (!deleted) throw notFound(`Task ${id} not found`);
      await detachRecordUploads("task", id, trx);
      await notifyTaskChanged(trx, id);
    });
}

/** 让任务用这次上传作为封面，替换原来的封面。上传的核对和幂等规则见 demo-upload 的 `attachUpload`。 */
export async function setTaskCoverRecord(
  id: string,
  input: { uploadId: unknown },
) {
  if (typeof input.uploadId !== "string" || !input.uploadId) {
    throw badRequest("uploadId must be a string", { param: "uploadId" });
  }
  const uploadId = input.uploadId;
  const row = await getTaskDb()
    .transaction()
    .execute(async (trx) => {
      await findTaskRow(trx, id, { forUpdate: true });
      await attachUpload(
        {
          uploadId,
          purpose: "task-cover",
          recordType: "task",
          recordId: id,
          name: "cover",
        },
        trx,
      );
      return trx
        .updateTable("tasks")
        .set({ updated_at: new Date() })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  return toTask(row);
}

export const createTask = demoOperation(
  "task.create",
  "write",
  createTaskRecord,
);
export const renameTask = demoOperation(
  "task.rename",
  "write",
  renameTaskRecord,
);
export const setTaskFavorite = demoOperation(
  "task.setFavorite",
  "write",
  setTaskFavoriteRecord,
);
export const retryTask = demoOperation("task.retry", "write", retryTaskRecord);
export const deleteTask = demoOperation(
  "task.delete",
  "write",
  deleteTaskRecord,
);
export const setTaskCover = demoOperation(
  "task.setCover",
  "write",
  setTaskCoverRecord,
);
