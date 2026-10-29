import type { Page } from "@playwright/test";

import { expect, resetThroughLab, test } from "./mock-api";

// 任务详情：数据由 React Query 负责（任务会在用户停留时自己推进），首屏由服务端 prefetch。

const GLOBAL_ERROR_TOAST = "请求失败，请稍后重试";

const comments = (page: Page) =>
  page.getByRole("list", { name: "评论" }).getByRole("listitem");

async function expectTaskNotFound(page: Page) {
  // 静态 shell 先以 200 发出，状态码改不了；notFound() 流式送达提示页，并加上 noindex 防止被索引。
  await expect(page.getByRole("heading", { name: "任务不存在" })).toBeVisible();
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]'),
  ).not.toHaveCount(0);
}

test.describe("首屏和 404", () => {
  test("不存在的任务显示提示页，并标记 noindex", async ({ page }) => {
    await page.goto("/demos/tasks/task-404");

    await expectTaskNotFound(page);
  });

  test("标题进 metadata，服务端渲染时详情接口只请求一次", async ({
    page,
    mockApi,
  }) => {
    await page.goto("/demos/tasks/task-01");

    await expect(page).toHaveTitle(/低多边形狐狸/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "低多边形狐狸",
    );
    expect(await mockApi.requests("/demo/tasks/:id")).toHaveLength(1);
  });

  test("首屏 HTML 已经包含详情，hydration 后浏览器不再请求详情", async ({
    page,
    request,
    mockApi,
  }) => {
    const html = await (await request.get("/demos/tasks/task-01")).text();
    expect(html).toContain("一只低多边形风格的狐狸");

    await mockApi.reset();
    await page.goto("/demos/tasks/task-01");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(1000);
    expect(await mockApi.requests("/demo/tasks/:id")).toHaveLength(1);
  });

  test("评论在详情之后流式出现", async ({ page, mockApi }) => {
    await mockApi.setFaults([
      { method: "GET", path: "/demo/tasks/:id/comments", latency_ms: 1500 },
    ]);
    await page.goto("/demos/tasks/task-01", { waitUntil: "commit" });

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("评论加载中")).toBeVisible();
    await expect(comments(page)).toHaveCount(2);
  });

  test("同 prompt 的其他任务在详情之后加载", async ({ page }) => {
    await page.goto("/demos/tasks/task-01");

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
    mockApi,
  }) => {
    await page.goto("/demos/tasks/task-11");
    await expect(page.getByText("进行中 4")).toBeVisible();
    await expect(page.getByTestId("task-status")).toHaveText("排队中");

    await mockApi.advance("task-11", 2);
    await expect(page.getByTestId("task-status")).toHaveText("生成中");
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "25",
    );

    await mockApi.advance("task-11", 4);
    await expect(page.getByTestId("task-status")).toHaveText("已完成");
    await expect(page.getByText("进行中 3")).toBeVisible();
  });

  test("回到标签页时徽标立即刷新", async ({ page, mockApi }) => {
    await page.goto("/demos/tasks/task-01");
    await expect(page.getByText("进行中 4")).toBeVisible();

    await mockApi.advance("task-03", 3);
    // 浏览器切回标签页时在 document 上触发会冒泡的 visibilitychange，React Query 在 window 上监听。
    await page.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange", { bubbles: true })),
    );

    await expect(page.getByText("进行中 3")).toBeVisible({ timeout: 3000 });
  });

  test("生成日志用 SSE 推送，到终态后结束", async ({ page, mockApi }) => {
    await page.goto("/demos/tasks/task-11");
    const logs = page.getByRole("log", { name: "生成日志" });

    await mockApi.advance("task-11", 2);
    await expect(logs).toContainText("开始生成");
    await expect(logs).toContainText("解析 prompt");

    await mockApi.advance("task-11", 4);
    await expect(logs).toContainText("生成完成");
    await expect(page.getByText("日志已结束")).toBeVisible();
  });

  test("任务在别处被删除后显示已删除，不弹通用提示", async ({
    page,
    mockApi,
  }) => {
    await page.goto("/demos/tasks/task-03");
    await expect(page.getByTestId("task-status")).toHaveText("生成中");

    await mockApi.call("DELETE", "/demo/tasks/task-03");

    await expect(page.getByText("任务已被删除")).toBeVisible();
    await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(0);
  });
});

test.describe("写入", () => {
  test.beforeEach(async ({ page }) => {
    await resetThroughLab(page);
  });

  test("重试失败的任务后重新开始推进，列表立即反映新状态", async ({
    page,
    mockApi,
  }) => {
    await page.goto("/demos/tasks/task-05");
    await page.getByRole("button", { name: "重试" }).click();
    await expect(page.getByTestId("task-status")).toHaveText("排队中");

    await mockApi.advance("task-05", 1);
    await expect(page.getByTestId("task-status")).toHaveText("生成中");

    await page.goto("/demos/tasks?status=failed");
    await expect(
      page.getByRole("link", { name: "机甲 fail 测试" }),
    ).toHaveCount(0);
  });

  test("任务已在别处重试过时就地提示并刷新详情", async ({ page, mockApi }) => {
    await page.goto("/demos/tasks/task-05");
    await mockApi.call("POST", "/demo/tasks/task-05/retry");

    await page.getByRole("button", { name: "重试" }).click();

    await expect(page.getByText("任务状态已变化")).toBeVisible();
    await expect(page.getByTestId("task-status")).toHaveText("排队中");
    await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(0);
  });

  test("删除任务后回到列表，任务不再出现，详情显示不存在", async ({ page }) => {
    await page.goto("/demos/tasks/task-02");
    await page.getByRole("button", { name: "删除任务" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "删除" })
      .click();

    await expect(page).toHaveURL("/demos/tasks");
    await expect(page.getByRole("link", { name: "坐着的狐狸 v2" })).toHaveCount(
      0,
    );
    await page.goto("/demos/tasks/task-02");
    await expectTaskNotFound(page);
  });

  test("重命名表单从当前数据开始编辑，撞名时在字段上提示", async ({ page }) => {
    await page.goto("/demos/tasks/task-01");
    await page.getByRole("button", { name: "重命名" }).click();
    const input = page.getByLabel("新名称");
    await expect(input).toHaveValue("低多边形狐狸");

    await input.fill("坐着的狐狸 v2");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("名称已被其他任务占用")).toBeVisible();
    await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(0);

    await input.fill("改名后的狐狸");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "改名后的狐狸",
    );

    // task-01 是最早创建的任务，按创建时间正序时在第一页。
    await page.goto("/demos/tasks?sort=created_asc");
    await expect(
      page.getByRole("link", { name: "改名后的狐狸" }),
    ).toBeVisible();
  });

  test("取消重命名后恢复显示原名称", async ({ page }) => {
    await page.goto("/demos/tasks/task-01");
    await page.getByRole("button", { name: "重命名" }).click();
    await page.getByLabel("新名称").fill("不保存的名称");
    await page.getByRole("button", { name: "取消" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "低多边形狐狸",
    );
    await page.getByRole("button", { name: "重命名" }).click();
    await expect(page.getByLabel("新名称")).toHaveValue("低多边形狐狸");
  });

  test("浏览器直接上传封面图后，详情和列表的缩略图都更新", async ({ page }) => {
    await page.goto("/demos/tasks/task-03");
    const cover = page.getByTestId("task-cover");
    await expect(cover).not.toHaveAttribute("src", /.+/);

    await page.getByLabel("更换封面图").setInputFiles({
      name: "cover.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
    });
    await expect(page.getByTestId("task-cover")).toHaveAttribute(
      "src",
      /\/demo\/tasks\/task-03\/cover\?v=1/,
    );

    await page.goto("/demos/tasks?status=running");
    const row = page.getByRole("listitem").filter({ hasText: "橙色狐狸草稿" });
    // 封面图是装饰性图片（alt 为空），没有 img 角色，按标签定位。
    await expect(row.locator("img")).toHaveAttribute(
      "src",
      /\/demo\/tasks\/task-03\/cover\?v=1/,
    );
  });
});

test.describe("下载", () => {
  test("done 的任务可以下载 .glb 模型文件", async ({ page }) => {
    await page.goto("/demos/tasks/task-01");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载模型" }).click();

    expect((await download).suggestedFilename()).toBe("低多边形狐狸.glb");
  });

  test("下载失败时提示", async ({ page, mockApi }) => {
    await mockApi.setFaults([
      { method: "GET", path: "/demo/tasks/:id/model", status: 500 },
    ]);
    await page.goto("/demos/tasks/task-01");
    await page.getByRole("button", { name: "下载模型" }).click();

    await expect(page.getByText("下载失败，请稍后重试")).toBeVisible();
  });

  test("没有完成的任务不能下载", async ({ page }) => {
    await page.goto("/demos/tasks/task-03");
    await expect(page.getByRole("button", { name: "下载模型" })).toHaveCount(0);
  });
});

test.describe("评论", () => {
  test("发表评论立即显示为发送中，成功后标记消失", async ({
    page,
    mockApi,
  }) => {
    await mockApi.setFaults([
      { method: "POST", path: "/demo/tasks/:id/comments", latency_ms: 1500 },
    ]);
    await page.goto("/demos/tasks/task-01");
    await page.getByLabel("写评论").fill("新评论");
    await page.getByRole("button", { name: "发表" }).click();

    await expect(comments(page).last()).toContainText("新评论");
    await expect(comments(page).last()).toContainText("发送中");
    await expect(page.getByLabel("写评论")).toHaveValue("");
    await expect(comments(page).last()).not.toContainText("发送中");
    await expect(comments(page)).toHaveCount(3);
  });

  test("发表失败时评论消失，输入框恢复内容，只弹一个全局提示", async ({
    page,
    mockApi,
  }) => {
    await mockApi.setFaults([
      { method: "POST", path: "/demo/tasks/:id/comments", status: 500 },
    ]);
    await page.goto("/demos/tasks/task-01");
    await page.getByLabel("写评论").fill("发不出去的评论");
    await page.getByRole("button", { name: "发表" }).click();

    await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(1);
    await expect(comments(page)).toHaveCount(2);
    await expect(page.getByLabel("写评论")).toHaveValue("发不出去的评论");
  });

  test("删除评论立即消失，失败时恢复原位", async ({ page, mockApi }) => {
    await page.goto("/demos/tasks/task-01");
    await comments(page)
      .first()
      .getByRole("button", { name: "删除评论" })
      .click();
    await expect(comments(page)).toHaveCount(1);

    await mockApi.setFaults([
      {
        method: "DELETE",
        path: "/demo/tasks/:id/comments/:commentId",
        status: 500,
      },
    ]);
    await comments(page)
      .first()
      .getByRole("button", { name: "删除评论" })
      .click();
    await expect(page.getByText(GLOBAL_ERROR_TOAST)).toBeVisible();
    await expect(comments(page)).toHaveCount(1);
  });

  test("空评论和超过 500 字的评论不能提交", async ({ page, mockApi }) => {
    await page.goto("/demos/tasks/task-01");
    await page.getByRole("button", { name: "发表" }).click();
    await expect(page.getByText("请输入评论")).toBeVisible();

    await page.getByLabel("写评论").fill("长".repeat(501));
    await page.getByRole("button", { name: "发表" }).click();
    await expect(page.getByText("评论最多 500 个字")).toBeVisible();
    expect(await mockApi.requests("/demo/tasks/:id/comments")).toHaveLength(1);
  });
});
