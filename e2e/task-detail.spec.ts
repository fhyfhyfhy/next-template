import type { Page } from "@playwright/test";

import { expect, runningCount, test, unique } from "./backend";
import {
  delayRequests,
  failRequests,
  hasPath,
  isServerAction,
  returnToTab,
} from "./browser";

// 任务详情：数据由 React Query 负责（任务会在用户停留时自己推进），首屏由服务端 prefetch。
// 只读的用例看种子数据里的任务；要改数据的用例各自建一个任务，不动种子数据。

const GLOBAL_ERROR_TOAST = "请求失败，请稍后重试";

const comments = (page: Page) =>
  page.getByRole("list", { name: "评论" }).getByRole("listitem");

/**
 * 打开详情并等 hydration 完成：首屏 HTML 先到，hydration 之前的点击和文件选择没有事件处理。
 * “同 prompt 的其他任务”只在浏览器里请求，它出现说明页面已经 hydrate。
 */
async function openTask(page: Page, taskId: string) {
  await page.goto(`/tasks/${taskId}`);
  await expect(
    page
      .getByRole("list", { name: "同 prompt 的其他任务" })
      .or(page.getByText("没有其他任务")),
  ).toBeVisible();
}

async function expectTaskNotFound(page: Page) {
  // 静态 shell 先以 200 发出，状态码改不了；notFound() 流式送达提示页，并加上 noindex 防止被索引。
  await expect(page.getByRole("heading", { name: "任务不存在" })).toBeVisible();
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]'),
  ).not.toHaveCount(0);
}

/** 记下浏览器发出的 Server Action 请求，断言“没有发请求”时用。 */
function serverActions(page: Page) {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (isServerAction(request)) requests.push(request.url());
  });
  return requests;
}

test.describe("首屏和 404", () => {
  test("不存在的任务显示提示页，并标记 noindex", async ({ page }) => {
    await page.goto("/tasks/task-404");

    await expectTaskNotFound(page);
  });

  test("不存在的任务按 200 返回：静态 shell 在读到 params 之前就发出了", async ({
    request,
  }) => {
    // 这是 framework-notes.md 的 Response status 记录的 Next.js 行为；升级后它变成真正的 404，就更新那条记录和这里。
    const response = await request.get("/tasks/task-404");

    expect(response.status()).toBe(200);
    expect(response.headers()["x-nextjs-postponed"]).toBe("1");
    expect(await response.text()).toContain(
      '<meta name="robots" content="noindex"/>',
    );
  });

  test("标题进 metadata", async ({ page }) => {
    await page.goto("/tasks/task-01");

    await expect(page).toHaveTitle(/低多边形狐狸/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "低多边形狐狸",
    );
  });

  test("首屏 HTML 已经包含详情，hydration 后浏览器不再请求详情", async ({
    page,
    request,
  }) => {
    const html = await (await request.get("/tasks/task-01")).text();
    expect(html).toContain("一只低多边形风格的狐狸");

    const detailRequests: string[] = [];
    page.on("request", (sent) => {
      if (hasPath("/api/tasks/task-01")(sent)) detailRequests.push(sent.url());
    });
    await page.goto("/tasks/task-01");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- 断言 hydration 后一段时间内没有再请求详情，等待是断言的一部分。
    await page.waitForTimeout(1000);
    expect(detailRequests).toStrictEqual([]);
  });

  test("评论在详情之后流式出现", async ({ page, backend }) => {
    // 锁住评论表：服务端读评论时一直等着，详情先送达。
    const release = await backend.holdTable("task_comments");
    try {
      await page.goto("/tasks/task-01", { waitUntil: "commit" });

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("评论加载中")).toBeVisible();
    } finally {
      await release();
    }
    await expect(comments(page)).toHaveCount(2);
  });

  test("同 prompt 的其他任务在详情之后加载", async ({ page }) => {
    await page.goto("/tasks/task-01");

    const related = page.getByRole("list", { name: "同 prompt 的其他任务" });
    await expect(related.getByRole("listitem")).toHaveText([
      /橙色狐狸草稿/,
      /坐着的狐狸 v2/,
    ]);
  });
});

test.describe("任务推进", () => {
  test("运行中的任务停留在页面上也会更新进度，到终态后徽标数量减少", async ({
    page,
    backend,
  }) => {
    const task = await backend.createTask();
    await openTask(page, task.id);
    const before = await runningCount(page);
    await expect(page.getByTestId("task-status")).toHaveText("排队中");

    await backend.reportProgress(task.id, {
      status: "running",
      progress: 25,
      log: "解析 prompt",
    });
    await expect(page.getByTestId("task-status")).toHaveText("生成中");
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "25",
    );

    await backend.reportProgress(task.id, {
      status: "done",
      progress: 100,
      log: "生成完成",
    });
    await expect(page.getByTestId("task-status")).toHaveText("已完成");
    await expect(page.getByText(`进行中 ${before - 1}`)).toBeVisible();
  });

  test("回到标签页时徽标立即刷新", async ({ page, backend }) => {
    const task = await backend.createTask({ status: "running", progress: 50 });
    await openTask(page, "task-01");
    const before = await runningCount(page);

    await backend.reportProgress(task.id, {
      status: "done",
      progress: 100,
      log: "生成完成",
    });
    await returnToTab(page);

    await expect(page.getByText(`进行中 ${before - 1}`)).toBeVisible({
      timeout: 3000,
    });
  });

  test("生成日志用 SSE 推送，到终态后结束", async ({ page, backend }) => {
    const task = await backend.createTask();
    await openTask(page, task.id);
    const logs = page.getByRole("log", { name: "生成日志" });

    await backend.reportProgress(task.id, {
      status: "running",
      progress: 0,
      log: "开始生成",
    });
    await backend.reportProgress(task.id, {
      status: "running",
      progress: 25,
      log: "解析 prompt",
    });
    await expect(logs).toContainText("开始生成");
    await expect(logs).toContainText("解析 prompt");

    await backend.reportProgress(task.id, {
      status: "done",
      progress: 100,
      log: "生成完成",
    });
    await expect(logs).toContainText("生成完成");
    await expect(page.getByText("日志已结束")).toBeVisible();
  });

  test("任务在别处被删除后显示已删除，不弹通用提示", async ({
    page,
    backend,
  }) => {
    const task = await backend.createTask({ status: "running", progress: 50 });
    await openTask(page, task.id);
    await expect(page.getByTestId("task-status")).toHaveText("生成中");

    await backend.deleteTask(task.id);

    await expect(page.getByText("任务已被删除")).toBeVisible();
    await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(0);
  });
});

test.describe("写入", () => {
  test("重试失败的任务后重新开始推进，列表立即反映新状态", async ({
    page,
    backend,
  }) => {
    const task = await backend.createTask({ status: "failed" });
    await openTask(page, task.id);
    const retried = page.waitForResponse((response) =>
      isServerAction(response.request()),
    );
    await page.getByRole("button", { name: "重试" }).click();
    // 重试是乐观更新：服务端处理之前就显示排队中，等 action 返回后再推进，任务才已经回到 pending。
    await expect(page.getByTestId("task-status")).toHaveText("排队中");
    await retried;

    await backend.reportProgress(task.id, {
      status: "running",
      progress: 0,
      log: "开始生成",
    });
    await expect(page.getByTestId("task-status")).toHaveText("生成中");

    await page.goto("/tasks?status=failed");
    await expect(page.getByRole("link", { name: task.name })).toHaveCount(0);
  });

  test("任务已在别处重试过时就地提示并刷新详情", async ({ page, backend }) => {
    const task = await backend.createTask({ status: "failed" });
    await openTask(page, task.id);
    await backend.retryTask(task.id);

    await page.getByRole("button", { name: "重试" }).click();

    await expect(page.getByText("任务状态已变化")).toBeVisible();
    await expect(page.getByTestId("task-status")).toHaveText("排队中");
    await expect(page.getByText("重试任务失败，请稍后重试")).toHaveCount(0);
  });

  test("删除任务后回到列表，任务不再出现，详情显示不存在", async ({
    page,
    backend,
  }) => {
    const task = await backend.createTask({ status: "done" });
    await openTask(page, task.id);
    await page.getByRole("button", { name: "删除任务" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "删除" })
      .click();

    await expect(page).toHaveURL("/tasks");
    await expect(page.getByRole("link", { name: task.name })).toHaveCount(0);
    await page.goto(`/tasks/${task.id}`);
    await expectTaskNotFound(page);
  });

  test("重命名表单从当前数据开始编辑，撞名时在字段上提示", async ({
    page,
    backend,
  }) => {
    const task = await backend.createTask({ status: "done" });
    await openTask(page, task.id);
    await page.getByRole("button", { name: "重命名" }).click();
    const input = page.getByLabel("新名称");
    await expect(input).toHaveValue(task.name);

    // 种子数据里的任务名。
    await input.fill("坐着的狐狸 v2");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("名称已被其他任务占用")).toBeVisible();
    await expect(page.getByText("重命名任务失败，请稍后重试")).toHaveCount(0);

    const renamed = unique("改名后的任务");
    await input.fill(renamed);
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(renamed);

    // 新建的任务最晚创建，按创建时间倒序时在第一页。
    await page.goto("/tasks");
    await expect(page.getByRole("link", { name: renamed })).toBeVisible();
  });

  test("取消重命名后恢复显示原名称", async ({ page }) => {
    await openTask(page, "task-01");
    await page.getByRole("button", { name: "重命名" }).click();
    await page.getByLabel("新名称").fill("不保存的名称");
    await page.getByRole("button", { name: "取消" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "低多边形狐狸",
    );
    await page.getByRole("button", { name: "重命名" }).click();
    await expect(page.getByLabel("新名称")).toHaveValue("低多边形狐狸");
  });

  test("浏览器把封面图直传对象存储后，详情和列表的缩略图都更新", async ({
    page,
    backend,
  }) => {
    const task = await backend.createTask({ status: "running", progress: 50 });
    await openTask(page, task.id);
    const cover = page.getByTestId("task-cover");
    await expect(cover).not.toHaveAttribute("src", /.+/);

    await page.getByLabel("更换封面图").setInputFiles({
      name: "cover.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
    });
    await expect(page.getByTestId("task-cover")).toHaveAttribute(
      "src",
      /\/uploads\/[^/]+$/,
    );

    await page.goto("/tasks?status=running");
    const row = page.getByRole("listitem").filter({ hasText: task.name });
    // 封面图是装饰性图片（alt 为空），没有 img 角色，按标签定位。
    await expect(row.locator("img")).toHaveAttribute(
      "src",
      /\/uploads\/[^/]+$/,
    );
  });

  test("选中的不是图片时直接提示，不签发上传", async ({ page }) => {
    await openTask(page, "task-03");
    const actions = serverActions(page);

    await page.getByLabel("更换封面图").setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });

    await expect(page.getByText("只能上传图片。")).toBeVisible();
    await expect(page.getByTestId("task-cover")).not.toHaveAttribute(
      "src",
      /.+/,
    );
    expect(actions).toStrictEqual([]);
  });

  test("选中的图片超过 5 MB 时直接提示，不签发上传", async ({ page }) => {
    await openTask(page, "task-03");
    const actions = serverActions(page);

    await page.getByLabel("更换封面图").setInputFiles({
      name: "huge.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    });

    await expect(page.getByText("图片不能超过 5 MB。")).toBeVisible();
    expect(actions).toStrictEqual([]);
  });
});

test.describe("下载", () => {
  test("done 的任务可以下载 .glb 模型文件", async ({ page }) => {
    await openTask(page, "task-01");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载模型" }).click();

    expect((await download).suggestedFilename()).toBe("低多边形狐狸.glb");
  });

  test("下载接口 302 到对象存储的短期地址，文件以任务名作为附件名", async ({
    request,
  }) => {
    const redirect = await request.get("/api/tasks/task-01/model", {
      maxRedirects: 0,
    });
    expect(redirect.status()).toBe(302);
    const location = redirect.headers().location ?? "";
    expect(new URL(location).searchParams.has("X-Amz-Signature")).toBe(true);

    const file = await request.get(location);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-disposition"]).toBe(
      `attachment; filename*=UTF-8''${encodeURIComponent("低多边形狐狸.glb")}`,
    );
  });

  test("下载失败时提示", async ({ page }) => {
    await openTask(page, "task-01");
    await failRequests(page, hasPath("/api/tasks/task-01/model"));
    await page.getByRole("button", { name: "下载模型" }).click();

    await expect(page.getByText("下载失败，请稍后重试")).toBeVisible();
  });

  test("没有完成的任务不能下载", async ({ page }) => {
    await page.goto("/tasks/task-03");
    await expect(page.getByRole("button", { name: "下载模型" })).toHaveCount(0);
  });
});

test.describe("评论", () => {
  test("发表评论立即显示为发送中，成功后标记消失", async ({
    page,
    backend,
  }) => {
    const task = await backend.createTask({ status: "done" });
    await openTask(page, task.id);
    await delayRequests(page, isServerAction, 1500);
    await page.getByLabel("写评论").fill("新评论");
    await page.getByRole("button", { name: "发表" }).click();

    await expect(comments(page).last()).toContainText("新评论");
    await expect(comments(page).last()).toContainText("发送中");
    await expect(page.getByLabel("写评论")).toHaveValue("");
    await expect(comments(page).last()).not.toContainText("发送中");
    await expect(comments(page)).toHaveCount(1);
  });

  test("发表失败时评论消失，输入框恢复内容，只弹一个全局提示", async ({
    page,
  }) => {
    await openTask(page, "task-01");
    await failRequests(page, isServerAction);
    await page.getByLabel("写评论").fill("发不出去的评论");
    await page.getByRole("button", { name: "发表" }).click();

    await expect(page.getByText("发表评论失败，请稍后重试")).toHaveCount(1);
    await expect(comments(page)).toHaveCount(2);
    await expect(page.getByLabel("写评论")).toHaveValue("发不出去的评论");
  });

  test("删除评论立即消失，失败时恢复原位", async ({ page, backend }) => {
    const task = await backend.createTask({ status: "done" });
    await backend.addComments(task.id, ["第一条评论", "第二条评论"]);
    await openTask(page, task.id);
    await comments(page)
      .first()
      .getByRole("button", { name: "删除评论" })
      .click();
    await expect(comments(page)).toHaveCount(1);

    await failRequests(page, isServerAction);
    await comments(page)
      .first()
      .getByRole("button", { name: "删除评论" })
      .click();
    await expect(page.getByText("删除评论失败，请稍后重试")).toBeVisible();
    await expect(comments(page)).toHaveCount(1);
  });

  test("空评论和超过 500 字的评论不能提交", async ({ page }) => {
    await openTask(page, "task-01");
    const actions = serverActions(page);
    await page.getByRole("button", { name: "发表" }).click();
    await expect(page.getByText("请输入评论")).toBeVisible();

    await page.getByLabel("写评论").fill("长".repeat(501));
    await page.getByRole("button", { name: "发表" }).click();
    await expect(page.getByText("评论最多 500 个字")).toBeVisible();
    expect(actions).toStrictEqual([]);
  });

  test("hydration 之前评论表单不可用", async ({ page }) => {
    // 拦掉 JS bundle，页面停在 hydration 之前。
    await page.route(/\/_next\/static\/chunks\/.+\.js/, (route) =>
      route.abort(),
    );
    await page.goto("/tasks/task-01");

    await expect(page.getByLabel("写评论")).toBeDisabled();
    await expect(page.getByRole("button", { name: "发表" })).toBeDisabled();
  });
});
