import { sql } from "kysely";
import { describe, expect, test } from "vitest";

import { createDedicatedClient, getDb } from "@/lib/db";

import { COMMENT_CONTENT_INVALID } from "../constants/error-codes";
import { taskCommentSchema } from "../types/task";
import { createComment, deleteComment, listComments } from "./comments";
import { expectWireSafe, rejection } from "./db-test-helpers";

describe("评论", () => {
  test("按发表时间从早到晚排列", async () => {
    const comments = await listComments("task-01");
    expect(comments.map((comment) => comment.content)).toStrictEqual([
      "耳朵的面数可以再少一点，更有低多边形的感觉。",
      "配色很好，导出给游戏原型用了。",
    ]);
    for (const comment of comments) expectWireSafe(taskCommentSchema, comment);
  });

  test("发表的评论去掉首尾空白排在最后，空评论和超过 500 字的评论按 COMMENT_CONTENT_INVALID 拒绝", async () => {
    const created = await createComment("task-01", { content: "  第三条  " });
    expect(created).toMatchObject({ taskId: "task-01", content: "第三条" });
    expect((await listComments("task-01")).at(-1)?.id).toBe(created.id);

    expect(
      await rejection(createComment("task-01", { content: "  " })),
    ).toStrictEqual({
      status: 400,
      code: COMMENT_CONTENT_INVALID,
      param: "content",
      params: { max: 500 },
    });
    expect(
      (await rejection(createComment("task-01", { content: "长".repeat(501) })))
        .code,
    ).toBe(COMMENT_CONTENT_INVALID);
  });

  test("任务不存在时发表评论 404", async () => {
    expect(
      (await rejection(createComment("task-404", { content: "评论" }))).status,
    ).toBe(404);
  });

  test("发表评论时任务被同时删除，按任务不存在 404", async () => {
    // 另一个连接删掉任务先不提交：评论的外键检查要等这一行的锁，提交后才发现任务没了。先查任务存在再插入的写法
    // 这时查得到任务，插入却违反外键。
    const other = createDedicatedClient();
    await other.connect();
    try {
      await other.query("begin");
      await other.query("delete from tasks where id = 'task-01'");
      const created = rejection(createComment("task-01", { content: "评论" }));
      await expect
        .poll(async () => {
          const { rows } = await sql<{ waiting: string }>`
            select count(*) as waiting from pg_stat_activity
            where wait_event_type = 'Lock' and query like 'insert into "task_comments"%'
          `.execute(getDb());
          return rows[0]?.waiting;
        })
        .toBe("1");
      await other.query("commit");
      expect((await created).status).toBe(404);
    } finally {
      await other.end();
    }
  });

  test("删除评论，评论不属于这个任务时 404", async () => {
    await deleteComment("task-01", "comment-01");
    expect(await listComments("task-01")).toHaveLength(1);
    expect(
      (await rejection(deleteComment("task-04", "comment-02"))).status,
    ).toBe(404);
  });
});
