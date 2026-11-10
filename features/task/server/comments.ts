import "server-only";
import type { Selectable } from "kysely";
import { nanoid } from "nanoid";
import { DatabaseError } from "pg";
import { cache } from "react";

import { notFound } from "@/lib/request/domain-error";

import { COMMENT_CONTENT_INVALID } from "../constants/error-codes";
import { COMMENT_MAX_LENGTH } from "../constants/task-rules";
import type { TaskComment } from "../types/task";
import { requireText } from "../utils/text-rules";
import { getTaskDb } from "./connection";
import type { TaskCommentsTable } from "./tables";
import { findTaskRow } from "./tasks";

function toComment(row: Selectable<TaskCommentsTable>): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    content: row.content,
    createdAt: row.created_at.getTime(),
  };
}

/** 任务的评论，按发表时间从早到晚；任务不存在时 404。 */
export const listComments = cache(async (taskId: string) => {
  const db = getTaskDb();
  await findTaskRow(db, taskId);
  const rows = await db
    .selectFrom("task_comments")
    .selectAll()
    .where("task_id", "=", taskId)
    .orderBy("created_at")
    .orderBy("id")
    .execute();
  return rows.map(toComment);
});

/** 发表评论：内容去掉首尾空白后不能为空，也不能超过 `COMMENT_MAX_LENGTH` 个字，否则按 `COMMENT_CONTENT_INVALID` 拒绝。 */
export async function createComment(
  taskId: string,
  input: { content: unknown },
) {
  const content = requireText(
    input.content,
    "content",
    COMMENT_MAX_LENGTH,
    COMMENT_CONTENT_INVALID,
  );
  try {
    const row = await getTaskDb()
      .insertInto("task_comments")
      .values({
        id: nanoid(),
        task_id: taskId,
        content,
        created_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toComment(row);
  } catch (error) {
    // 外键保证任务存在：任务不存在，或者在这之前刚被删除，都按任务不存在拒绝。
    if (
      error instanceof DatabaseError &&
      error.code === "23503" &&
      error.constraint === "task_comments_task_id_fkey"
    ) {
      throw notFound(`Task ${taskId} not found`);
    }
    throw error;
  }
}

export async function deleteComment(taskId: string, commentId: string) {
  const db = getTaskDb();
  await findTaskRow(db, taskId);
  const deleted = await db
    .deleteFrom("task_comments")
    .where("id", "=", commentId)
    .where("task_id", "=", taskId)
    .executeTakeFirst();
  if (Number(deleted.numDeletedRows) === 0) {
    throw notFound(`Comment ${commentId} not found`);
  }
}
