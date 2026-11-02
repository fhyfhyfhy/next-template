import type { Page } from "@playwright/test";

import { returnToTab } from "../browser";
import { expect, resetThroughLab, test } from "./mock-api";

// Task detail: React Query owns the data (the task advances on its own while
// the user stays), and the server prefetches it for the first render.

const GLOBAL_ERROR_TOAST = "请求失败，请稍后重试";

const comments = (page: Page) =>
  page.getByRole("list", { name: "评论" }).getByRole("listitem");

/**
 * Opens a task's detail and waits for hydration: the first HTML arrives
 * first, and before hydration nothing handles a click or a file choice. The
 * other tasks with the same prompt are requested only in the browser, so once
 * they show, the page has hydrated.
 */
async function openTask(page: Page, taskId: string) {
  await page.goto(`/demos/tasks/${taskId}`);
  await expect(
    page
      .getByRole("list", { name: "同 prompt 的其他任务" })
      .or(page.getByText("没有其他任务")),
  ).toBeVisible();
}

async function expectTaskNotFound(page: Page) {
  // The static shell goes out first with a 200, which cannot change; notFound()
  // streams the not-found page and adds noindex to keep it out of search
  // indexes.
  await expect(page.getByRole("heading", { name: "任务不存在" })).toBeVisible();
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]'),
  ).not.toHaveCount(0);
}

test.describe("first render and 404", () => {
  test("a missing task shows the not-found page, marked noindex", async ({
    page,
  }) => {
    await page.goto("/demos/tasks/task-404");

    await expectTaskNotFound(page);
  });

  test("a missing task answers 200: the static shell goes out before params are read", async ({
    request,
  }) => {
    // Next.js behavior recorded under Response status in framework-notes.md;
    // when an upgrade turns this into a real 404, update that record and this
    // test.
    const response = await request.get("/demos/tasks/task-404");

    expect(response.status()).toBe(200);
    expect(response.headers()["x-nextjs-postponed"]).toBe("1");
    expect(await response.text()).toContain(
      '<meta name="robots" content="noindex"/>',
    );
  });

  test("the title goes into metadata, and server rendering requests the detail endpoint once", async ({
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

  test("the first HTML already holds the detail, and the browser does not request it again after hydration", async ({
    page,
    request,
    mockApi,
  }) => {
    const html = await (await request.get("/demos/tasks/task-01")).text();
    expect(html).toContain("一只低多边形风格的狐狸");

    await mockApi.reset();
    await page.goto("/demos/tasks/task-01");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- asserts that no detail request follows hydration for a while; the wait is part of the assertion
    await page.waitForTimeout(1000);
    expect(await mockApi.requests("/demo/tasks/:id")).toHaveLength(1);
  });

  test("comments stream in after the detail", async ({ page, mockApi }) => {
    await mockApi.setFaults([
      { method: "GET", path: "/demo/tasks/:id/comments", latency_ms: 1500 },
    ]);
    await page.goto("/demos/tasks/task-01", { waitUntil: "commit" });

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("评论加载中")).toBeVisible();
    await expect(comments(page)).toHaveCount(2);
  });

  test("other tasks with the same prompt load after the detail", async ({
    page,
  }) => {
    await page.goto("/demos/tasks/task-01");

    const related = page.getByRole("list", { name: "同 prompt 的其他任务" });
    await expect(related.getByRole("listitem")).toHaveText([
      /橙色狐狸草稿/,
      /坐着的狐狸 v2/,
    ]);
  });
});

test.describe("task progress", () => {
  test("an in-progress task updates its progress while the user stays on the page, and the badge count drops at its terminal status", async ({
    page,
    mockApi,
  }) => {
    await openTask(page, "task-11");
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

  test("returning to the tab refreshes the badge at once", async ({
    page,
    mockApi,
  }) => {
    await openTask(page, "task-01");
    await expect(page.getByText("进行中 4")).toBeVisible();

    await mockApi.advance("task-03", 3);
    await returnToTab(page);

    await expect(page.getByText("进行中 3")).toBeVisible({ timeout: 3000 });
  });

  test("the generation log is pushed over SSE and ends at the terminal status", async ({
    page,
    mockApi,
  }) => {
    await openTask(page, "task-11");
    const logs = page.getByRole("log", { name: "生成日志" });

    await mockApi.advance("task-11", 2);
    await expect(logs).toContainText("开始生成");
    await expect(logs).toContainText("解析 prompt");

    await mockApi.advance("task-11", 4);
    await expect(logs).toContainText("生成完成");
    await expect(page.getByText("日志已结束")).toBeVisible();
  });

  test("a task deleted elsewhere shows as deleted, with no generic toast", async ({
    page,
    mockApi,
  }) => {
    await openTask(page, "task-03");
    await expect(page.getByTestId("task-status")).toHaveText("生成中");

    await mockApi.call("DELETE", "/demo/tasks/task-03");

    await expect(page.getByText("任务已被删除")).toBeVisible();
    await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(0);
  });
});

test.describe("writes", () => {
  test.beforeEach(async ({ page }) => {
    await resetThroughLab(page);
  });

  test("a retried failed task starts advancing again, and the list reflects its new status at once", async ({
    page,
    mockApi,
  }) => {
    await openTask(page, "task-05");
    await page.getByRole("button", { name: "重试" }).click();
    await expect(page.getByTestId("task-status")).toHaveText("排队中");

    await mockApi.advance("task-05", 1);
    await expect(page.getByTestId("task-status")).toHaveText("生成中");

    await page.goto("/demos/tasks?status=failed");
    await expect(
      page.getByRole("link", { name: "机甲 fail 测试" }),
    ).toHaveCount(0);
  });

  test("a task already retried elsewhere says so in place and refreshes the detail", async ({
    page,
    mockApi,
  }) => {
    await openTask(page, "task-05");
    await mockApi.call("POST", "/demo/tasks/task-05/retry");

    await page.getByRole("button", { name: "重试" }).click();

    await expect(page.getByText("任务状态已变化")).toBeVisible();
    await expect(page.getByTestId("task-status")).toHaveText("排队中");
    await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(0);
  });

  test("deleting a task returns to the list, where it no longer appears, and its detail shows not found", async ({
    page,
  }) => {
    await openTask(page, "task-02");
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

  test("the rename form starts from the current data and shows a name clash on the field", async ({
    page,
  }) => {
    await openTask(page, "task-01");
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

    // task-01 is the earliest task, so it is on the first page in ascending
    // creation order.
    await page.goto("/demos/tasks?sort=created_asc");
    await expect(
      page.getByRole("link", { name: "改名后的狐狸" }),
    ).toBeVisible();
  });

  test("cancelling a rename shows the original name again", async ({
    page,
  }) => {
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

  test("after the browser uploads a cover image directly, the detail and the list thumbnail both update", async ({
    page,
  }) => {
    await openTask(page, "task-03");
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
    // The cover is a decorative image (empty alt) with no img role, so it is
    // located by tag name.
    await expect(row.locator("img")).toHaveAttribute(
      "src",
      /\/demo\/tasks\/task-03\/cover\?v=1/,
    );
  });
});

test.describe("download", () => {
  test("a done task can be downloaded as a .glb model file", async ({
    page,
  }) => {
    await openTask(page, "task-01");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载模型" }).click();

    expect((await download).suggestedFilename()).toBe("低多边形狐狸.glb");
  });

  test("a failed download shows a message", async ({ page, mockApi }) => {
    await mockApi.setFaults([
      { method: "GET", path: "/demo/tasks/:id/model", status: 500 },
    ]);
    await openTask(page, "task-01");
    await page.getByRole("button", { name: "下载模型" }).click();

    await expect(page.getByText("下载失败，请稍后重试")).toBeVisible();
  });

  test("a task that is not done cannot be downloaded", async ({ page }) => {
    await page.goto("/demos/tasks/task-03");
    await expect(page.getByRole("button", { name: "下载模型" })).toHaveCount(0);
  });
});

test.describe("comments", () => {
  test("a posted comment shows as sending at once, and the mark goes away on success", async ({
    page,
    mockApi,
  }) => {
    await mockApi.setFaults([
      { method: "POST", path: "/demo/tasks/:id/comments", latency_ms: 1500 },
    ]);
    await openTask(page, "task-01");
    await page.getByLabel("写评论").fill("新评论");
    await page.getByRole("button", { name: "发表" }).click();

    await expect(comments(page).last()).toContainText("新评论");
    await expect(comments(page).last()).toContainText("发送中");
    await expect(page.getByLabel("写评论")).toHaveValue("");
    await expect(comments(page).last()).not.toContainText("发送中");
    await expect(comments(page)).toHaveCount(3);
  });

  test("a failed post removes the comment, restores the input, and shows a single global toast", async ({
    page,
    mockApi,
  }) => {
    await mockApi.setFaults([
      { method: "POST", path: "/demo/tasks/:id/comments", status: 500 },
    ]);
    await openTask(page, "task-01");
    await page.getByLabel("写评论").fill("发不出去的评论");
    await page.getByRole("button", { name: "发表" }).click();

    await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(1);
    await expect(comments(page)).toHaveCount(2);
    await expect(page.getByLabel("写评论")).toHaveValue("发不出去的评论");
  });

  test("a deleted comment disappears at once and comes back in place on failure", async ({
    page,
    mockApi,
  }) => {
    await openTask(page, "task-01");
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

  test("an empty comment or one over 500 characters cannot be submitted", async ({
    page,
    mockApi,
  }) => {
    await openTask(page, "task-01");
    await page.getByRole("button", { name: "发表" }).click();
    await expect(page.getByText("请输入评论")).toBeVisible();

    await page.getByLabel("写评论").fill("长".repeat(501));
    await page.getByRole("button", { name: "发表" }).click();
    await expect(page.getByText("评论最多 500 个字")).toBeVisible();
    expect(await mockApi.requests("/demo/tasks/:id/comments")).toHaveLength(1);
  });

  test("the comment form is disabled before hydration", async ({ page }) => {
    // With the JS bundles aborted, the page stays unhydrated.
    await page.route(/\/_next\/static\/chunks\/.+\.js/, (route) =>
      route.abort(),
    );
    await page.goto("/demos/tasks/task-01");

    await expect(page.getByLabel("写评论")).toBeDisabled();
    await expect(page.getByRole("button", { name: "发表" })).toBeDisabled();
  });
});
