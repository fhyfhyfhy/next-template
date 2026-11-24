import type { Locator, Page, Request } from "@playwright/test";

import { failServerRead, holdTable, unique } from "./backend";
import {
  delayRequests,
  expectNativelyDisabled,
  failRequests,
  hasPath,
  holdRequests,
  isServerAction,
  openWithoutScripts,
  recordRequests,
  returnToTab,
  waitForServerAction,
} from "./browser";
import {
  createTaskThroughForm,
  expect,
  isActiveTasksRequest,
  openTasksPage,
  runningCount,
  type TaskData,
  taskRow,
  taskRows,
  test,
  untilPolled,
} from "./tasks";
import { GLOBAL_ERROR_TOAST } from "./test";

// 任务详情：数据由 React Query 负责（任务会在用户停留时自己推进），首屏由服务端 prefetch。
// 只读的用例看种子数据里的任务；要改数据的用例各自建一个任务，不动种子数据。

const comments = (page: Page) =>
  page.getByRole("list", { name: "评论" }).getByRole("listitem");
const logs = (page: Page) => page.getByRole("log", { name: "生成日志" });
/** 日志区里的段落：收到的每一行日志；还在推送、一行都没收到时是「等待日志…」占位。 */
const logLines = (log: Locator) => log.getByRole("paragraph");

/**
 * 打开详情并等 hydration 完成：首屏 HTML 先到，hydration 之前的点击和文件选择没有事件处理。
 * “同 prompt 的其他任务”由服务端预取、以 pending 状态流式送到浏览器，只在浏览器里渲染，它出现说明页面已经 hydrate。
 */
async function openTask(page: Page, taskId: string) {
  await page.goto(`/tasks/${taskId}`);
  await expect(
    page
      .getByRole("list", { name: "同 prompt 的其他任务" })
      .or(page.getByText("没有其他任务")),
  ).toBeVisible();
}

/** 建一个刚失败的任务并打开详情，等日志读完上一轮：失败的那行和「日志已结束」都在。 */
async function openFailedTask(page: Page, tasks: TaskData) {
  const task = await tasks.createTask({ status: "running", progress: 75 });
  await tasks.reportProgress(task.id, {
    status: "failed",
    progress: 100,
    log: "生成失败：材质计算出错",
  });
  await openTask(page, task.id);
  await expect(logs(page)).toContainText("生成失败：材质计算出错");
  await expect(page.getByText("日志已结束")).toBeVisible();
  return task;
}

/**
 * 让详情页的“同 prompt 的其他任务”首次加载失败，等加载失败的提示出现。进行中的任务才会轮询详情、拿到别处改过的
 * prompt；拿到新 prompt 后相关任务换成按它查询，这个 query 还没有数据，它的第一次请求失败就是首次加载失败。4xx 不重试。
 */
async function failRelatedTasksFirstLoad(page: Page, tasks: TaskData) {
  const prompt = unique("e2e prompt");
  const other = await tasks.createTask({ prompt, status: "done" });
  const task = await tasks.createTask({ status: "running", progress: 50 });
  await openTask(page, task.id);
  const isRelatedRequest = (request: Request) =>
    new URL(request.url()).searchParams.get("prompt") === prompt;
  const restore = await failRequests(page, isRelatedRequest, { status: 400 });
  await tasks.changePrompt(task.id, prompt);
  const failed = page.getByRole("alert").filter({ hasText: "加载失败" });
  await expect(failed).toBeVisible();
  return {
    other,
    failed,
    // 可访问名称写明重试的是什么，和失败任务的 TaskActions 里的「重试」分得清。
    retry: failed.getByRole("button", {
      name: "重试加载同 prompt 的其他任务",
      exact: true,
    }),
    isRelatedRequest,
    restore,
  };
}

/**
 * 打开任务详情，让评论首次加载失败，等评论区的加载失败出现，返回恢复评论请求的函数。服务端读评论时锁住评论表，再取消
 * 等锁的读取，像数据库读失败：流式送到浏览器的评论 query 跟着失败，浏览器重试时请求评论接口，这里也让它失败（4xx 不再
 * 重试），错误到达评论区的错误边界。
 */
async function openTaskWithCommentsFailed(page: Page, taskId: string) {
  const restore = await failRequests(
    page,
    hasPath(`/api/tasks/${taskId}/comments`),
    { status: 400 },
  );
  await failServerRead("task_comments", () =>
    page.goto(`/tasks/${taskId}`, { waitUntil: "commit" }),
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "评论加载失败" }),
  ).toBeVisible();
  return restore;
}

async function expectTaskNotFound(page: Page) {
  // 静态 shell 先以 200 发出，状态码改不了；notFound() 流式送达提示页，并加上 noindex 防止被索引。
  await expect(page.getByRole("heading", { name: "任务不存在" })).toBeVisible();
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]'),
  ).not.toHaveCount(0);
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

    const detailRequests = recordRequests(page, hasPath("/api/tasks/task-01"));
    // openTask 等到只在浏览器里渲染的内容出现，计时从 hydration 之后开始。
    await openTask(page, "task-01");
    // eslint-disable-next-line playwright/no-wait-for-timeout -- 断言 hydration 后一段时间内没有再请求详情，等待是断言的一部分。
    await page.waitForTimeout(1000);
    expect(detailRequests).toStrictEqual([]);
  });

  test("评论在详情之后流式出现", async ({ page }) => {
    // 锁住评论表：服务端读评论时一直等着，详情先送达。
    const release = await holdTable("task_comments");
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
    tasks,
  }) => {
    const task = await tasks.createTask();
    await openTask(page, task.id);
    const before = await runningCount(page);
    await expect(page.getByTestId("task-status")).toHaveText("排队中");

    await tasks.reportProgress(task.id, {
      status: "running",
      progress: 25,
      log: "解析 prompt",
    });
    await expect(page.getByTestId("task-status")).toHaveText("生成中");
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "25",
    );

    await tasks.reportProgress(task.id, {
      status: "done",
      progress: 100,
      log: "生成完成",
    });
    await expect(page.getByTestId("task-status")).toHaveText("已完成");
    await expect(page.getByText(`进行中 ${before - 1}`)).toBeVisible();
  });

  test("回到标签页时徽标立即刷新", async ({ page, tasks }) => {
    const task = await tasks.createTask({ status: "running", progress: 50 });
    await openTask(page, "task-01");
    // 等一次轮询返回：有进行中的任务时（种子数据里一直有）下一次轮询在 3 秒后，1 秒内的更新只能来自回到标签页时的刷新。
    await page.waitForResponse((response) =>
      isActiveTasksRequest(response.request()),
    );
    const before = await runningCount(page);

    await tasks.reportProgress(task.id, {
      status: "done",
      progress: 100,
      log: "生成完成",
    });
    await returnToTab(page);

    await expect(page.getByText(`进行中 ${before - 1}`)).toBeVisible({
      timeout: 1000,
    });
  });

  test("生成日志用 SSE 推送，任务到终态后重新读一遍完整日志并结束", async ({
    page,
    tasks,
  }) => {
    const task = await tasks.createTask();
    await openTask(page, task.id);

    await tasks.reportProgress(task.id, {
      status: "running",
      progress: 0,
      log: "开始生成",
    });
    await tasks.reportProgress(task.id, {
      status: "running",
      progress: 25,
      log: "解析 prompt",
    });
    await expect(logLines(logs(page))).toHaveText(["开始生成", "解析 prompt"]);

    await tasks.reportProgress(task.id, {
      status: "done",
      progress: 100,
      log: "生成完成",
    });
    // 详情显示终态的那次渲染里日志重新订阅、状态回到推送中，之后出现的「日志已结束」来自读完整日志的这次订阅。
    await expect(page.getByTestId("task-status")).toHaveText("已完成");
    await expect(page.getByText("日志已结束")).toBeVisible();
    // 比较完整的日志：重新订阅时没清空，就会出现重复的行。
    await expect(logLines(logs(page))).toHaveText([
      "开始生成",
      "解析 prompt",
      "生成完成",
    ]);
  });

  test("日志区在 Tab 顺序里，内容超出高度时键盘用户能聚焦它来滚动", async ({
    page,
    tasks,
  }) => {
    const task = await tasks.createTask();
    await openTask(page, task.id);

    // 排队中的任务的「删除任务」之后，下一个 Tab 位置就是日志区。
    await page.getByRole("button", { name: "删除任务" }).focus();
    await page.keyboard.press("Tab");

    await expect(logs(page)).toBeFocused();
  });

  test("任务到终态、日志重新订阅时，聚焦的日志区不重新挂载", async ({
    page,
    tasks,
  }) => {
    const task = await tasks.createTask({ status: "running", progress: 50 });
    await openTask(page, task.id);
    await logs(page).focus();

    await tasks.reportProgress(task.id, {
      status: "done",
      progress: 100,
      log: "生成完成",
    });
    await expect(page.getByTestId("task-status")).toHaveText("已完成");
    await expect(page.getByText("日志已结束")).toBeVisible();

    // 日志区还是同一个元素，焦点留在上面，不掉到 body。
    await expect(logs(page)).toBeFocused();
  });

  test("重试确认后日志清空上一轮，重新开始推送", async ({ page, tasks }) => {
    const task = await openFailedTask(page, tasks);
    const retried = waitForServerAction(page);
    await page.getByRole("button", { name: "重试", exact: true }).click();
    await retried;

    await expect(logs(page)).not.toContainText("生成失败");
    await expect(page.getByText("日志已结束")).toHaveCount(0);
    await tasks.reportProgress(task.id, {
      status: "running",
      progress: 0,
      log: "开始生成",
    });
    await expect(logLines(logs(page))).toHaveText(["开始生成"]);
  });

  test("重试时日志重新订阅，聚焦的日志区不重新挂载", async ({
    page,
    tasks,
  }) => {
    const task = await openFailedTask(page, tasks);
    const release = await holdRequests(page, isServerAction);
    await page.getByRole("button", { name: "重试", exact: true }).click();
    // 「重试」随乐观更新消失，在重试确认之前把焦点放到日志区上。
    await logs(page).focus();
    const retried = waitForServerAction(page);
    release();
    await retried;

    await tasks.reportProgress(task.id, {
      status: "running",
      progress: 0,
      log: "开始生成",
    });
    await expect(logs(page)).toContainText("开始生成");
    await expect(logs(page)).toBeFocused();
  });

  test("任务在别处被删除后显示已删除，不弹通用提示", async ({
    page,
    tasks,
  }) => {
    const task = await tasks.createTask({ status: "running", progress: 50 });
    await openTask(page, task.id);
    await expect(page.getByTestId("task-status")).toHaveText("生成中");

    await tasks.deleteTask(task.id);

    await expect(page.getByText("任务已被删除")).toBeVisible();
    await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(0);
  });
});

test.describe("请求失败", () => {
  test("相关任务首次加载失败时就地显示加载失败，不弹全局提示", async ({
    page,
    tasks,
  }) => {
    const { failed } = await failRelatedTasksFirstLoad(page, tasks);

    await expect(failed).toBeVisible();
    await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(0);
  });

  test("相关任务重试期间加载失败的提示不卸载，按钮停用、键盘焦点留在按钮上", async ({
    page,
    tasks,
  }) => {
    const { retry, isRelatedRequest, restore } =
      await failRelatedTasksFirstLoad(page, tasks);
    await restore();
    // 重试的请求停在浏览器里，断言请求进行中的样子。
    const release = await holdRequests(page, isRelatedRequest);

    await retry.press("Enter");

    await expect(retry).toBeDisabled();
    await expect(retry).toBeFocused();
    release();
  });

  test("相关任务重试成功后显示列表", async ({ page, tasks }) => {
    const { other, retry, restore } = await failRelatedTasksFirstLoad(
      page,
      tasks,
    );
    await restore();

    await retry.click();

    await expect(
      page.getByRole("list", { name: "同 prompt 的其他任务" }),
    ).toContainText(other.name);
  });

  test("评论首次加载失败时就地显示加载失败，重试按钮的名称写明重试的是评论", async ({
    page,
    tasks,
  }) => {
    const task = await tasks.createTask({ status: "done" });

    await openTaskWithCommentsFailed(page, task.id);

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "评论加载失败" })
        .getByRole("button"),
    ).toHaveAccessibleName("重试加载评论");
  });

  test("评论加载失败后重试，评论出现，键盘焦点移到评论区标题", async ({
    page,
    tasks,
  }) => {
    const task = await tasks.createTask({ status: "done" });
    await tasks.addComments(task.id, ["第一条评论"]);
    const restore = await openTaskWithCommentsFailed(page, task.id);
    await restore();

    await page
      .getByRole("button", { name: "重试加载评论", exact: true })
      .press("Enter");

    await expect(comments(page)).toHaveText([/第一条评论/]);
    // 重新加载时 Suspense 的 fallback 换掉了按钮；评论出现后焦点在评论区标题上，不在 body 上。
    await expect(
      page.getByRole("heading", { name: "评论", exact: true }),
    ).toBeFocused();
  });

  test("评论重试又失败时，键盘焦点移到新的重试按钮", async ({
    page,
    tasks,
  }) => {
    const task = await tasks.createTask({ status: "done" });
    await openTaskWithCommentsFailed(page, task.id);
    const retry = page.getByRole("button", {
      name: "重试加载评论",
      exact: true,
    });
    // 浏览器的评论请求停住，等评论区换成加载中、旧的按钮已经卸载再放行，放行后照样失败。重试还会刷新页面，服务端再读
    // 一次评论：让这次读取失败，它不会把评论送到浏览器。
    const releaseRequest = await holdRequests(
      page,
      hasPath(`/api/tasks/${task.id}/comments`),
    );
    await failServerRead("task_comments", async () => {
      await retry.press("Enter");
      await expect(page.getByText("评论加载中")).toBeVisible();
    });
    releaseRequest();

    await expect(retry).toBeFocused();
  });

  test("评论重试期间焦点已移到别处时，评论出现后焦点留在原处", async ({
    page,
    tasks,
  }) => {
    const task = await tasks.createTask({ status: "done" });
    await tasks.addComments(task.id, ["第一条评论"]);
    const restore = await openTaskWithCommentsFailed(page, task.id);
    await restore();
    // 浏览器的评论请求停住，加载期间把焦点移到输入框。重试还会刷新页面，服务端再读一次评论：让这次读取失败，评论只从
    // 这个请求到达。
    const releaseRequest = await holdRequests(
      page,
      hasPath(`/api/tasks/${task.id}/comments`),
    );
    await failServerRead("task_comments", async () => {
      await page
        .getByRole("button", { name: "重试加载评论", exact: true })
        .press("Enter");
      await expect(page.getByText("评论加载中")).toBeVisible();
      await page.getByLabel("写评论").focus();
    });
    releaseRequest();

    await expect(comments(page)).toHaveText([/第一条评论/]);
    // FocusAfterRetry 的 effect 在评论显示出来的那次提交之后才跑，等过它再看焦点。焦点被移走就不会再回到输入框，
    // 所以最后看一次就够。
    // eslint-disable-next-line playwright/no-wait-for-timeout -- 等过 effect 之后焦点仍在输入框，等待是断言的一部分。
    await page.waitForTimeout(500);
    await expect(page.getByLabel("写评论")).toBeFocused();
  });

  test("已有数据时刷新失败，保留数据并弹全局提示", async ({ page, tasks }) => {
    const task = await tasks.createTask({ status: "running", progress: 50 });
    await openTask(page, task.id);
    await expect(page.getByTestId("task-status")).toHaveText("生成中");

    // 4xx 不重试，下一次轮询的失败立即可见。
    await failRequests(page, hasPath(`/api/tasks/${task.id}`), { status: 400 });

    await expect(page.getByText(GLOBAL_ERROR_TOAST)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(task.name);
    await expect(page.getByTestId("task-status")).toHaveText("生成中");
  });

  test("无关的请求同时失败各弹一个提示，同一个请求再次失败不增加提示", async ({
    page,
    tasks,
  }) => {
    const task = await tasks.createTask({ status: "running", progress: 50 });
    await openTask(page, task.id);

    // 详情每 1.5 秒、header 徽标每 3 秒轮询一次，两个都让它失败。
    await failRequests(
      page,
      (request) =>
        hasPath(`/api/tasks/${task.id}`)(request) ||
        isActiveTasksRequest(request),
      { status: 400 },
    );

    await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(2);
    // 再等过几次轮询：同一个请求又失败时更新自己的提示，不增加新的。
    await page.waitForResponse(
      (response) =>
        isActiveTasksRequest(response.request()) && response.status() === 400,
    );
    await page.waitForResponse(
      (response) =>
        hasPath(`/api/tasks/${task.id}`)(response.request()) &&
        response.status() === 400,
    );
    // 提示在响应之后才更新：再等一会儿，去重坏掉时多出来的提示有时间出现。
    // eslint-disable-next-line playwright/no-wait-for-timeout -- 等过这段时间提示仍是两个，等待是断言的一部分。
    await page.waitForTimeout(500);
    await expect(page.getByText(GLOBAL_ERROR_TOAST)).toHaveCount(2);
  });
});

test.describe("写入", () => {
  test("重试失败的任务后重新开始推进，列表立即反映新状态", async ({
    page,
    tasks,
  }) => {
    await openTasksPage(page);
    const task = await createTaskThroughForm(page);
    await tasks.reportProgress(task.id, {
      status: "failed",
      progress: 100,
      log: "生成失败：材质计算出错",
    });
    // 列表页发现任务结束后重新读取列表，失败筛选里才有它。
    await expect(taskRow(page, task.name)).toContainText("失败", untilPolled);
    await page.goto("/tasks?status=failed");
    await expect(taskRow(page, task.name)).toBeVisible();

    await openTask(page, task.id);
    // 重试的 Server Action 放行之前，排队中只能来自乐观更新；等 action 返回后再推进，任务才已经回到 pending。
    const release = await holdRequests(page, isServerAction);
    await page.getByRole("button", { name: "重试", exact: true }).click();
    await expect(page.getByTestId("task-status")).toHaveText("排队中");
    const retried = waitForServerAction(page);
    release();
    await retried;

    await tasks.reportProgress(task.id, {
      status: "running",
      progress: 0,
      log: "开始生成",
    });
    await expect(page.getByTestId("task-status")).toHaveText("生成中");

    // 不运行应用的 JS 看列表：列表页的变化信号发现任务重新进行中，也会让列表的缓存失效。
    const list = await openWithoutScripts(page, "/tasks?status=failed");
    await expect(taskRows(list).first()).toBeVisible();
    await expect(taskRow(list, task.name)).toHaveCount(0);
    await list.close();
  });

  test("重试失败时恢复为失败，只弹一个全局提示", async ({ page, tasks }) => {
    const task = await tasks.createTask({ status: "failed" });
    await openTask(page, task.id);
    await failRequests(page, isServerAction);
    const release = await holdRequests(page, isServerAction);

    await page.getByRole("button", { name: "重试", exact: true }).click();
    await expect(page.getByTestId("task-status")).toHaveText("排队中");
    release();

    await expect(page.getByText("重试任务失败，请稍后重试")).toHaveCount(1);
    await expect(page.getByTestId("task-status")).toHaveText("失败");
  });

  test("任务已在别处重试过时就地提示并刷新详情", async ({ page, tasks }) => {
    const task = await tasks.createTask({ status: "failed" });
    await openTask(page, task.id);
    await tasks.retryTask(task.id);

    await page.getByRole("button", { name: "重试", exact: true }).click();

    await expect(page.getByText("任务状态已变化")).toBeVisible();
    await expect(page.getByTestId("task-status")).toHaveText("排队中");
    await expect(page.getByText("重试任务失败，请稍后重试")).toHaveCount(0);
  });

  test("删除任务后回到列表，任务不再出现，详情显示不存在", async ({
    page,
    tasks,
  }) => {
    await openTasksPage(page);
    const task = await createTaskThroughForm(page);
    // 先让任务结束：列表的变化信号只看进行中的任务，删掉一个已结束的任务后，列表只能靠删除的 Server Action 刷新。
    await tasks.reportProgress(task.id, {
      status: "done",
      progress: 100,
      log: "生成完成",
    });
    await expect(taskRow(page, task.name)).toContainText("已完成", untilPolled);
    await openTask(page, task.id);
    await page.getByRole("button", { name: "删除任务" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "删除" })
      .click();

    await expect(page).toHaveURL("/tasks");
    await expect(taskRows(page).first()).toBeVisible();
    await expect(taskRow(page, task.name)).toHaveCount(0);
    await page.goto(`/tasks/${task.id}`);
    await expectTaskNotFound(page);
  });

  test("删除的请求进行中「删除」停用但保持键盘焦点，失败提示之后焦点仍在上面", async ({
    page,
    tasks,
  }) => {
    const task = await tasks.createTask({ status: "done" });
    await openTask(page, task.id);
    await page.getByRole("button", { name: "删除任务" }).click();
    const confirm = page
      .getByRole("dialog")
      .getByRole("button", { name: "删除", exact: true });
    await failRequests(page, isServerAction);
    const release = await holdRequests(page, isServerAction);

    await confirm.press("Enter");
    await expect(confirm).toBeDisabled();
    await expect(confirm).toBeFocused();
    release();

    await expect(page.getByText("删除任务失败，请稍后重试")).toBeVisible();
    await expect(confirm).toBeFocused();
  });

  test("任务名很长、中间没有能断行的地方时，删除对话框的标题换行，不撑出对话框", async ({
    page,
    tasks,
  }) => {
    // 名称最多 40 个字；一长串拉丁字母中间没有断行的位置，不换行的话比对话框宽。
    const task = await tasks.createTask({ name: unique("W".repeat(32)) });
    await openTask(page, task.id);

    await page.getByRole("button", { name: "删除任务" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toContainText(task.name);
    // 标题换行后内容不比对话框宽：滚动宽度等于可见宽度，对话框没有横向溢出。
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      ),
    ).toBe(0);
  });

  test("重命名表单从当前数据开始编辑，撞名时在字段上提示", async ({
    page,
    tasks,
  }) => {
    const task = await tasks.createTask();
    await openTask(page, task.id);
    await page.getByRole("button", { name: "重命名" }).click();
    const input = page.getByLabel("新名称");
    await expect(input).toHaveValue(task.name);

    // 种子数据里的任务名。
    await input.fill("坐着的狐狸 v2");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("名称已被其他任务占用")).toBeVisible();
    await expect(page.getByText("重命名任务失败，请稍后重试")).toHaveCount(0);
  });

  test("重命名撞名后焦点移到「新名称」，文字全部选中", async ({
    page,
    tasks,
  }) => {
    const task = await tasks.createTask();
    await openTask(page, task.id);
    await page.getByRole("button", { name: "重命名" }).click();
    const input = page.getByLabel("新名称");
    // 种子数据里的任务名。
    const takenName = "坐着的狐狸 v2";
    await input.fill(takenName);
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("名称已被其他任务占用")).toBeVisible();

    // 点「保存」时焦点在按钮上，服务端报撞名后移到出错的字段，并选中文字，直接输入就替换掉。
    await expect(input).toBeFocused();
    expect(
      await input.evaluate((element: HTMLInputElement) => [
        element.selectionStart,
        element.selectionEnd,
      ]),
    ).toStrictEqual([0, takenName.length]);
  });

  test("改名后详情和列表立即显示新名称，焦点回到「重命名」", async ({
    page,
  }) => {
    // 从列表页的表单建任务：列表的缓存里有它的旧名字，改名后列表要靠 Server Action 的失效才显示新名字。
    await openTasksPage(page);
    const task = await createTaskThroughForm(page);
    await openTask(page, task.id);
    await page.getByRole("button", { name: "重命名" }).click();
    const renamed = unique("改名后的任务");
    await page.getByLabel("新名称").fill(renamed);
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(renamed);
    // 表单卸载后焦点回到「重命名」，不掉到 body 上。
    await expect(page.getByRole("button", { name: "重命名" })).toBeFocused();

    // 新建的任务最晚创建，按创建时间倒序时在第一页。
    await page.goto("/tasks");
    await expect(taskRow(page, renamed)).toBeVisible();
  });

  test("取消重命名后恢复显示原名称，焦点回到「重命名」", async ({ page }) => {
    await openTask(page, "task-01");
    const rename = page.getByRole("button", { name: "重命名" });
    // 打开页面时不抢焦点，只有从表单回来时才聚焦它。
    await expect(rename).not.toBeFocused();
    await rename.click();
    await page.getByLabel("新名称").fill("不保存的名称");
    await page.getByRole("button", { name: "取消" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "低多边形狐狸",
    );
    await expect(rename).toBeFocused();
    await rename.click();
    await expect(page.getByLabel("新名称")).toHaveValue("低多边形狐狸");
  });

  test("浏览器把封面图直传对象存储后，详情和列表的缩略图都更新", async ({
    page,
    tasks,
  }) => {
    await openTasksPage(page);
    const task = await createTaskThroughForm(page);
    await tasks.reportProgress(task.id, {
      status: "running",
      progress: 50,
      log: "生成网格",
    });
    // 先让“生成中”筛选的缓存里有这个没有封面的任务，换封面后列表要靠 Server Action 的失效才更新。
    await page.goto("/tasks?status=running");
    const row = taskRow(page, task.name);
    await expect(row).toBeVisible(untilPolled);
    await expect(row.locator("img")).toHaveCount(0);

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
    // 封面图是装饰性图片（alt 为空），没有 img 角色，按 img 元素定位。
    await expect(row.locator("img")).toHaveAttribute(
      "src",
      /\/uploads\/[^/]+$/,
    );
  });

  test("上传封面期间不响应再次选择，键盘焦点留在选择按钮上", async ({
    page,
    tasks,
  }) => {
    const task = await tasks.createTask();
    await openTask(page, task.id);
    // 签发上传和设置封面的 Server Action 晚 1 秒返回，这期间上传保持进行中。
    await delayRequests(page, isServerAction, 1000);
    const picker = page.getByLabel(/^(更换封面图|上传中…)$/);
    await picker.focus();
    const chooser = page.waitForEvent("filechooser");
    await page.keyboard.press("Space");
    await (
      await chooser
    ).setFiles({
      name: "cover.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
    });
    await expect(picker).toHaveAccessibleName("上传中…");

    // 断言的是 500 ms 内没有打开文件选择，超时就是期望的结果。
    const reopened = page
      .waitForEvent("filechooser", { timeout: 500 })
      .then(() => true)
      .catch(() => false);
    await page.keyboard.press("Space");

    expect(await reopened, "上传中再按一次不应打开文件选择").toBe(false);
    await expect(picker).toHaveAttribute("aria-disabled", "true");
    await expect(picker).toBeFocused();
    await expect(picker).toHaveAccessibleName("更换封面图");
  });

  test("选中的不是图片时直接提示，不签发上传", async ({ page }) => {
    await openTask(page, "task-03");
    const actions = recordRequests(page, isServerAction);

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
    const actions = recordRequests(page, isServerAction);

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
  test("首次加载出评论时，键盘焦点不移到评论区标题", async ({ page }) => {
    await openTask(page, "task-01");
    // 评论的时间在评论区 hydrate 之后才由浏览器填上：它出现时，和评论在同一个 Suspense 里的 FocusAfterRetry 已经挂载。
    await expect(comments(page).first().locator("time")).not.toBeEmpty();

    await expect(
      page.getByRole("heading", { name: "评论", exact: true }),
    ).not.toBeFocused();
  });

  test("发表评论立即显示为发送中，成功后标记消失", async ({ page, tasks }) => {
    const task = await tasks.createTask({ status: "done" });
    await openTask(page, task.id);
    const release = await holdRequests(page, isServerAction);
    await page.getByLabel("写评论").fill("新评论");
    await page.getByRole("button", { name: "发表" }).click();

    await expect(comments(page).last()).toContainText("新评论");
    await expect(comments(page).last()).toContainText("发送中");
    await expect(page.getByLabel("写评论")).toHaveValue("");
    release();
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

  test("删除评论立即消失", async ({ page, tasks }) => {
    const task = await tasks.createTask({ status: "done" });
    await tasks.addComments(task.id, ["第一条评论", "第二条评论"]);
    await openTask(page, task.id);
    // 删除的 Server Action 放行之前，评论只能是乐观更新拿掉的。
    const release = await holdRequests(page, isServerAction);

    await comments(page)
      .first()
      .getByRole("button", { name: "删除评论" })
      .click();

    await expect(comments(page)).toHaveText([/第二条评论/]);
    const deleted = waitForServerAction(page);
    release();
    await deleted;
    // 重新打开，读的是服务端的数据。
    await openTask(page, task.id);
    await expect(comments(page)).toHaveText([/第二条评论/]);
  });

  test("删除评论失败时恢复原位，只弹一个全局提示", async ({ page, tasks }) => {
    const task = await tasks.createTask({ status: "done" });
    await tasks.addComments(task.id, [
      "第一条评论",
      "第二条评论",
      "第三条评论",
    ]);
    await openTask(page, task.id);
    await failRequests(page, isServerAction);
    const release = await holdRequests(page, isServerAction);

    await comments(page)
      .nth(1)
      .getByRole("button", { name: "删除评论" })
      .click();
    await expect(comments(page)).toHaveCount(2);
    release();

    await expect(page.getByText("删除评论失败，请稍后重试")).toHaveCount(1);
    await expect(comments(page)).toHaveText([
      /第一条评论/,
      /第二条评论/,
      /第三条评论/,
    ]);
  });

  test("空评论和超过 500 字的评论不能提交", async ({ page }) => {
    await openTask(page, "task-01");
    const actions = recordRequests(page, isServerAction);
    await page.getByRole("button", { name: "发表" }).click();
    await expect(page.getByText("请输入评论")).toBeVisible();

    await page.getByLabel("写评论").fill("长".repeat(501));
    await page.getByRole("button", { name: "发表" }).click();
    await expect(page.getByText("评论最多 500 个字")).toBeVisible();
    expect(actions).toStrictEqual([]);
  });

  test("提交空评论后焦点移到输入框", async ({ page }) => {
    await openTask(page, "task-01");
    await page.getByRole("button", { name: "发表" }).click();
    await expect(page.getByText("请输入评论")).toBeVisible();

    // 点「发表」时焦点在按钮上，校验失败后移到输入框。
    await expect(page.getByLabel("写评论")).toBeFocused();
  });

  test("hydration 之前评论表单不可用", async ({ page }) => {
    const htmlPage = await openWithoutScripts(page, "/tasks/task-01");

    await expect(htmlPage.getByLabel("写评论")).toBeDisabled();
    await expectNativelyDisabled(
      htmlPage.getByRole("button", { name: "发表" }),
    );
    await htmlPage.close();
  });
});
