import { describe, expect, test } from "vitest";

import { UPLOAD_ALREADY_USED } from "@/features/upload";
import { createUpload } from "@/features/upload/server";
import { ErrorCode } from "@/lib/request/domain-error";

import {
  TASK_NAME_TAKEN,
  TASK_NOT_DONE,
  TASK_NOT_RETRYABLE,
} from "../constants/error-codes";
import { feedPageSchema, taskPageSchema, taskSchema } from "../types/task";
import { listComments } from "./comments";
import {
  advance,
  expectWireSafe,
  readLogs,
  rejection,
} from "./db-test-helpers";
import {
  createTask,
  deleteTask,
  getTask,
  getTaskModelUrl,
  listFeed,
  listTasks,
  renameTask,
  retryTask,
  searchTasks,
  setTaskCover,
  setTaskFavorite,
} from "./tasks";

/** 一个 1×1 的 PNG。 */
const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

/** 按浏览器的做法上传一个文件：签发上传、直传对象存储，返回上传的 id。 */
async function uploadImage(contentType: string, body: Uint8Array<ArrayBuffer>) {
  const { id, uploadUrl } = await createUpload({
    purpose: "task-cover",
    contentType,
    size: body.byteLength,
  });
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  expect(response.status).toBe(200);
  return id;
}

describe("任务列表", () => {
  test("按创建时间倒序分页返回种子数据", async () => {
    const page = await listTasks({ pageSize: 5 });

    expect(page.items.map((task) => task.id)).toStrictEqual([
      "task-20",
      "task-19",
      "task-18",
      "task-17",
      "task-16",
    ]);
    expect([page.total, page.page, page.pageSize, page.hasMore]).toStrictEqual([
      20,
      1,
      5,
      true,
    ]);
    expectWireSafe(taskPageSchema, page);
  });

  test("页码超出范围时返回空列表，每页最多 50 条", async () => {
    expect((await listTasks({ page: 5, pageSize: 5 })).items).toStrictEqual([]);
    expect((await listTasks({ pageSize: 500 })).pageSize).toBe(50);
  });

  test("按状态（可多选）、收藏、prompt 过滤，可以排除一个任务", async () => {
    const active = await listTasks({ status: ["pending", "running"] });
    expect(active.items.map((task) => task.id).sort()).toStrictEqual([
      "task-03",
      "task-11",
      "task-16",
      "task-19",
    ]);

    const favorites = await listTasks({ favorite: true });
    expect(favorites.items.map((task) => task.id).sort()).toStrictEqual([
      "task-01",
      "task-04",
      "task-08",
      "task-13",
    ]);

    const related = await listTasks({
      prompt: "一只低多边形风格的狐狸，坐姿，橙白配色",
      excludeId: "task-01",
    });
    expect(related.items.map((task) => task.name)).toStrictEqual([
      "橙色狐狸草稿",
      "坐着的狐狸 v2",
    ]);
  });

  test("按名称排序时中文按拼音排列，和浏览器的 zh-CN 排序一致", async () => {
    const page = await listTasks({ sort: "name_asc", pageSize: 50 });
    const names = page.items.map((task) => task.name);
    expect(names).toStrictEqual(
      [...names].sort((a, b) => a.localeCompare(b, "zh-CN")),
    );
  });

  test("按创建时间正序排列", async () => {
    const page = await listTasks({ sort: "created_asc", pageSize: 3 });
    expect(page.items.map((task) => task.id)).toStrictEqual([
      "task-01",
      "task-02",
      "task-03",
    ]);
  });
});

describe("任务的写入", () => {
  test("新建的任务去掉名称首尾空白，从 pending 开始，排在列表最前", async () => {
    const created = await createTask({
      name: "  新的狐狸  ",
      prompt: "一只狐狸",
    });

    expect(created).toMatchObject({
      name: "新的狐狸",
      status: "pending",
      progress: 0,
      favorite: false,
      coverUrl: null,
    });
    expect((await listTasks({ pageSize: 1 })).items[0].id).toBe(created.id);
    expectWireSafe(taskSchema, await getTask(created.id));
  });

  test("名称已被占用时按 TASK_NAME_TAKEN 拒绝创建和重命名，改成自己原来的名称不算冲突", async () => {
    expect(
      await rejection(createTask({ name: "低多边形狐狸", prompt: "一只狐狸" })),
    ).toStrictEqual({
      status: 409,
      code: TASK_NAME_TAKEN,
      param: "name",
      params: undefined,
    });
    expect(
      (await rejection(renameTask("task-02", { name: "低多边形狐狸" }))).code,
    ).toBe(TASK_NAME_TAKEN);
    expect((await renameTask("task-01", { name: "低多边形狐狸" })).name).toBe(
      "低多边形狐狸",
    );
  });

  test("名称为空或超过 40 字时按参数错误拒绝，params 带上限", async () => {
    expect(
      await rejection(createTask({ name: " ", prompt: "一只狐狸" })),
    ).toStrictEqual({
      status: 400,
      code: ErrorCode.BAD_REQUEST,
      param: "name",
      params: { max: 40 },
    });
    expect(
      (await rejection(renameTask("task-01", { name: "长".repeat(41) }))).param,
    ).toBe("name");
    expect(
      (await rejection(createTask({ name: "新任务", prompt: "" }))).param,
    ).toBe("prompt");
  });

  test("设置和取消收藏", async () => {
    expect(
      (await setTaskFavorite("task-02", { favorite: true })).favorite,
    ).toBe(true);
    expect(
      (await setTaskFavorite("task-02", { favorite: false })).favorite,
    ).toBe(false);
  });

  test("只有 failed 的任务能重试，重试后回到 pending、进度归零、日志清空", async () => {
    const retried = await retryTask("task-05");
    expect([retried.status, retried.progress]).toStrictEqual(["pending", 0]);
    expect(await readLogs("task-05", 1)).toStrictEqual([]);

    expect((await rejection(retryTask("task-05"))).code).toBe(
      TASK_NOT_RETRYABLE,
    );
    expect((await rejection(retryTask("task-01"))).code).toBe(
      TASK_NOT_RETRYABLE,
    );
  });

  test("删除任务时它的评论一起删除，之后读取返回 404", async () => {
    expect(await listComments("task-01")).toHaveLength(2);

    await deleteTask("task-01");

    expect((await rejection(getTask("task-01"))).status).toBe(404);
    expect((await rejection(listComments("task-01"))).status).toBe(404);
    expect((await rejection(deleteTask("task-01"))).status).toBe(404);
  });

  test("不存在的任务按 404 拒绝", async () => {
    expect(await rejection(getTask("task-99"))).toStrictEqual({
      status: 404,
      code: ErrorCode.NOT_FOUND,
      param: undefined,
      params: undefined,
    });
  });
});

describe("搜索", () => {
  test("按名称和 prompt 匹配关键词，不区分大小写，按创建时间倒序", async () => {
    const byPrompt = await searchTasks("狐狸");
    expect(byPrompt.map((task) => task.id)).toStrictEqual([
      "task-03",
      "task-02",
      "task-01",
    ]);
    expect((await searchTasks("FAIL")).map((task) => task.id)).toStrictEqual([
      "task-15",
      "task-09",
      "task-05",
    ]);
  });

  test("空关键词返回空列表，% 和 _ 按普通字符匹配", async () => {
    expect(await searchTasks("   ")).toStrictEqual([]);
    expect(await searchTasks("%")).toStrictEqual([]);
    expect(await searchTasks("_")).toStrictEqual([]);
  });
});

describe("作品广场", () => {
  test("只含 done 的任务，按创建时间倒序，用游标翻到最后一页", async () => {
    const first = await listFeed(null, 6);
    expect(first.items.map((task) => task.id)).toStrictEqual([
      "task-20",
      "task-18",
      "task-17",
      "task-14",
      "task-13",
      "task-12",
    ]);
    expectWireSafe(feedPageSchema, first);

    const second = await listFeed(first.nextCursor, 6);
    expect(second.items.map((task) => task.id)).toStrictEqual([
      "task-10",
      "task-08",
      "task-07",
      "task-06",
      "task-04",
      "task-02",
    ]);
    const last = await listFeed(second.nextCursor, 6);
    expect(last.items.map((task) => task.id)).toStrictEqual(["task-01"]);
    expect(last.nextCursor).toBeNull();
  });

  test("翻页期间有任务完成、排到最前，下一页不会重复上一页的任务", async () => {
    const first = await listFeed(null, 6);
    const { id } = await createTask({
      name: "翻页期间完成",
      prompt: "一只狐狸",
    });
    await advance(id, 6);

    const second = await listFeed(first.nextCursor, 6);
    expect(second.items[0].id).toBe("task-10");
    expect((await listFeed(null, 1)).items[0].id).toBe(id);
  });
});

describe("模型文件", () => {
  test("done 的任务可以下载 .glb，文件名是任务名", async () => {
    const response = await fetch(await getTaskModelUrl("task-01"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename*=UTF-8''${encodeURIComponent("低多边形狐狸.glb")}`,
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    // glb 文件头：magic "glTF"、版本 2、总长度。
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("glTF");
    expect(new DataView(bytes.buffer).getUint32(8, true)).toBe(bytes.length);
  });

  test("任务完成时产出模型，没完成时按 TASK_NOT_DONE 拒绝", async () => {
    const { id } = await createTask({ name: "模型测试", prompt: "一只狐狸" });
    expect((await rejection(getTaskModelUrl(id))).code).toBe(TASK_NOT_DONE);

    await advance(id, 6);

    expect((await fetch(await getTaskModelUrl(id))).status).toBe(200);
  });
});

describe("封面", () => {
  test("种子任务的封面可以直接读取，没有封面的任务为 null", async () => {
    const withCover = await getTask("task-01");
    const response = await fetch(withCover.coverUrl ?? "");
    expect([
      response.status,
      response.headers.get("content-type"),
    ]).toStrictEqual([200, "image/svg+xml"]);
    expect((await getTask("task-03")).coverUrl).toBeNull();
  });

  test("上传图片后设为封面，封面地址换成新文件，重复提交同一次上传不报错", async () => {
    const uploadId = await uploadImage("image/png", PNG);

    const task = await setTaskCover("task-03", { uploadId });
    const again = await setTaskCover("task-03", { uploadId });

    expect(again.coverUrl).toBe(task.coverUrl);
    const response = await fetch(task.coverUrl ?? "");
    expect(new Uint8Array(await response.arrayBuffer())).toStrictEqual(PNG);
    expect(
      (
        await listTasks({ excludeId: "task-01", prompt: task.prompt })
      ).items.find((item) => item.id === "task-03")?.coverUrl,
    ).toBe(task.coverUrl);
  });

  test("一次上传只能给一个任务做封面", async () => {
    const uploadId = await uploadImage("image/png", PNG);
    await setTaskCover("task-03", { uploadId });

    expect((await rejection(setTaskCover("task-11", { uploadId }))).code).toBe(
      UPLOAD_ALREADY_USED,
    );
  });

  test("不存在的任务按 404 拒绝", async () => {
    const uploadId = await uploadImage("image/png", PNG);
    expect(
      (await rejection(setTaskCover("task-99", { uploadId }))).status,
    ).toBe(404);
  });
});
