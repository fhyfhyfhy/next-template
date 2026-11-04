import { describe, expect, test } from "vitest";

import { COMMENT_CONTENT_INVALID } from "../constants/error-codes";
import { taskCommentSchema } from "../types/task";
import { createComment, deleteComment, listComments } from "./comments";
import {
  expectWireSafe,
  rejection,
  resetDemoBeforeEach,
} from "./db-test-helpers";

resetDemoBeforeEach();

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

  test("删除评论，评论不属于这个任务时 404", async () => {
    await deleteComment("task-01", "comment-01");
    expect(await listComments("task-01")).toHaveLength(1);
    expect(
      (await rejection(deleteComment("task-04", "comment-02"))).status,
    ).toBe(404);
  });
});
