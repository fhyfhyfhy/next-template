import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import type { Page, Request } from "@playwright/test";
import type { Kysely } from "kysely";
import { nanoid } from "nanoid";

import {
  connectE2eDatabase,
  connectE2eStorage,
  notify,
  unique,
} from "./backend";
import { clickForClientNavigation } from "./browser";
import { expect, test as base } from "./test";

// Sample product（任务和上传）的 e2e 数据和页面 helper。写入直接进 e2e 数据集，对应用来说就是“别处改了数据”：不让 Next
// 的服务端缓存失效，页面按自己的新鲜度规则才看到变化。
// 只描述用到的列；表结构以各 feature 的 server/migrations.mts 为准，改了结构要同步这里。

type TaskStatus = "pending" | "running" | "done" | "failed";

interface Tables {
  tasks: {
    id: string;
    name: string;
    prompt: string;
    status: TaskStatus;
    progress: number;
    favorite: boolean;
    created_at: Date;
    updated_at: Date;
  };
  task_comments: {
    id: string;
    task_id: string;
    content: string;
    created_at: Date;
  };
  task_logs: { task_id: string; line: string };
  uploads: {
    id: string;
    key: string;
    purpose: string;
    content_type: string;
    size: number;
  };
  upload_attachments: {
    upload_id: string;
    record_type: string;
    record_id: string;
    name: string;
  };
}

// 应用的 SSE 日志流监听这个频道（features/task/server/task-events.ts），任务变化后发通知，页面才收到新日志。
const TASK_CHANGED_CHANNEL = "task_changed";

// 生成服务产出的模型文件。内容只要是 GLB 的文件头就够：用例只看任务的状态，不解析模型。
const MODEL_BYTES = new Uint8Array([
  0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 12, 0, 0, 0,
]);

export interface CreatedTask {
  id: string;
  name: string;
  prompt: string;
}

export class TaskData {
  private readonly db: Kysely<Tables>;
  private readonly storage: S3Client;
  private readonly bucket: string;

  constructor() {
    this.db = connectE2eDatabase<Tables>();
    const { bucket, client } = connectE2eStorage();
    this.bucket = bucket;
    this.storage = client;
  }

  async close() {
    this.storage.destroy();
    await this.db.destroy();
  }

  /** 新建一个任务，默认排队中、没收藏、没有封面。`createdAt` 决定它在按创建时间排序的列表里的位置。 */
  async createTask({
    name = unique("e2e 任务"),
    prompt = unique("e2e prompt"),
    status = "pending",
    progress = status === "done" || status === "failed" ? 100 : 0,
    favorite = false,
    createdAt = new Date(),
  }: {
    name?: string;
    prompt?: string;
    status?: TaskStatus;
    progress?: number;
    favorite?: boolean;
    createdAt?: Date;
  } = {}): Promise<CreatedTask> {
    const id = `e2e-${nanoid()}`;
    await this.db
      .insertInto("tasks")
      .values({
        id,
        name,
        prompt,
        status,
        progress,
        favorite,
        created_at: createdAt,
        updated_at: createdAt,
      })
      .execute();
    return { id, name, prompt };
  }

  /** 这些名称的任务的创建时间（毫秒），按名称取。 */
  async createdAt(names: string[]) {
    const rows = await this.db
      .selectFrom("tasks")
      .select(["name", "created_at"])
      .where("name", "in", names)
      .execute();
    return new Map(rows.map((row) => [row.name, row.created_at.getTime()]));
  }

  /** 库里已完成的任务数，别的用例完成的也算在内。 */
  async countDone() {
    const { total } = await this.db
      .selectFrom("tasks")
      .select((eb) => eb.fn.countAll<string>().as("total"))
      .where("status", "=", "done")
      .executeTakeFirstOrThrow();
    return Number(total);
  }

  async addComments(taskId: string, contents: string[]) {
    const now = Date.now();
    await this.db
      .insertInto("task_comments")
      .values(
        contents.map((content, index) => ({
          id: `e2e-${nanoid()}`,
          task_id: taskId,
          content,
          created_at: new Date(now + index),
        })),
      )
      .execute();
  }

  /**
   * 像生成服务那样报告一次进度：更新状态和进度，写一条生成日志，并通知正在推送日志的页面。进入 done 时和
   * generator 一样产出模型文件，关联到任务上（features/task/server/generator.ts 的 `advanceTask`）。
   */
  async reportProgress(
    taskId: string,
    {
      status,
      progress,
      log,
    }: { status: TaskStatus; progress: number; log: string },
  ) {
    const model =
      status === "done" ? await this.saveModel(`e2e-${nanoid()}`) : null;
    await this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable("tasks")
        .set({ status, progress, updated_at: new Date() })
        .where("id", "=", taskId)
        .execute();
      await trx
        .insertInto("task_logs")
        .values({ task_id: taskId, line: log })
        .execute();
      if (model) {
        await trx.insertInto("uploads").values(model).execute();
        await trx
          .insertInto("upload_attachments")
          .values({
            upload_id: model.id,
            record_type: "task",
            record_id: taskId,
            name: "model",
          })
          .execute();
      }
      await notify(trx, TASK_CHANGED_CHANNEL, taskId);
    });
  }

  async renameTask(taskId: string, name: string) {
    await this.db
      .updateTable("tasks")
      .set({ name, updated_at: new Date() })
      .where("id", "=", taskId)
      .execute();
  }

  /** 失败的任务回到排队中，和应用里的重试一样清空日志。 */
  async retryTask(taskId: string) {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable("tasks")
        .set({ status: "pending", progress: 0, updated_at: new Date() })
        .where("id", "=", taskId)
        .execute();
      await trx.deleteFrom("task_logs").where("task_id", "=", taskId).execute();
      await notify(trx, TASK_CHANGED_CHANNEL, taskId);
    });
  }

  async deleteTask(taskId: string) {
    await this.db.transaction().execute(async (trx) => {
      // 评论和日志随外键删除；上传关联像应用的 deleteTask（features/task/server/tasks.ts）一样解除，上传记录留给清理任务。
      await trx
        .deleteFrom("upload_attachments")
        .where("record_type", "=", "task")
        .where("record_id", "=", taskId)
        .execute();
      await trx.deleteFrom("tasks").where("id", "=", taskId).execute();
      await notify(trx, TASK_CHANGED_CHANNEL, taskId);
    });
  }

  /** 把模型文件写进存储，key 的格式和应用里服务端产出的文件一样：`UPLOAD_KEY_PREFIX`（features/upload/constants/storage-keys.ts）加上传 id。 */
  private async saveModel(id: string) {
    const key = `uploads/${id}`;
    await this.storage.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: MODEL_BYTES,
        ContentType: "model/gltf-binary",
      }),
    );
    return {
      id,
      key,
      purpose: "task-model",
      content_type: "model/gltf-binary",
      size: MODEL_BYTES.byteLength,
    };
  }
}

/** `tasks` 在每个 worker 里连一次 e2e 数据集和存储。 */
export const test = base.extend<object, { tasks: TaskData }>({
  tasks: [
    async ({}, use) => {
      const tasks = new TaskData();
      await use(tasks);
      await tasks.close();
    },
    { scope: "worker" },
  ],
});

/**
 * 整页打开搜索页，再经导航栏在浏览器里导航到 `url`。导航栏是服务端渲染的，里面没有只在浏览器里出现的东西；
 * 搜索框在 hydration 之前不可用，它可用说明应用已经在浏览器里运行，这时点导航链接是客户端导航
 * （`clickForClientNavigation` 再确认一次）。到达的页面在浏览器里渲染，没有要等 hydrate 的部分。
 */
export async function enterThroughHeader(
  page: Page,
  link: string,
  url: string,
) {
  await page.goto("/search");
  await expect(page.getByLabel("搜索任务")).toBeEnabled();
  await navigateThroughHeader(page, link, url);
}

/** 在已经由浏览器渲染的任务页面上，经导航栏导航到 `url`。 */
export async function navigateThroughHeader(
  page: Page,
  link: string,
  url: string,
) {
  await clickForClientNavigation(
    page,
    page.getByRole("navigation", { name: "主要" }).getByRole("link", {
      name: link,
    }),
    url,
  );
}

export const taskRows = (page: Page) =>
  page.getByRole("list", { name: "任务列表" }).getByRole("listitem");

/** 列表里名称含 `name` 的那一行。 */
export const taskRow = (page: Page, name: string) =>
  taskRows(page).filter({ hasText: name });

// 有进行中的任务时页面每 3 秒检查一次（种子数据里一直有：e2e 里 generator 关着，排队和生成中的种子任务不会结束），
// 发现变化后再重新读取列表，等列表跟上要比默认的 5 秒宽。
export const untilPolled = { timeout: 10_000 };

/**
 * 换了筛选、排序或页码之后，等新列表到达：URL 先变，新列表随后才到，到达之前旧列表标记为 `aria-busy`。
 * 读列表的内容之前先等它。
 */
export async function waitForTaskList(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** 在已经打开的全部任务页上点一个状态筛选，等新列表到达。 */
export async function filterByStatus(page: Page, label: string, url: string) {
  await page
    .getByRole("navigation", { name: "按状态筛选" })
    .getByRole("link", { name: label })
    .click();
  await expect(page).toHaveURL(url);
  await waitForTaskList(page);
}

/** header 徽标轮询进行中任务的请求（带 status 参数）；相关任务、收藏也请求同一个路径，但不带它。 */
export function isActiveTasksRequest(request: Request) {
  const url = new URL(request.url());
  return url.pathname === "/api/tasks" && url.searchParams.has("status");
}

/** 经导航栏进入全部任务页，等列表出现。 */
export async function openTasksPage(page: Page) {
  await enterThroughHeader(page, "全部任务", "/tasks");
  await expect(taskRows(page).first()).toBeVisible();
}

/** 在已经打开的全部任务页上用表单建一个任务，等它出现在列表里，返回它的 id 和名称。 */
export async function createTaskThroughForm(
  page: Page,
  name = unique("新任务"),
) {
  await page.getByLabel("名称").fill(name);
  await page.getByLabel("Prompt").fill(unique("e2e prompt"));
  await page.getByRole("button", { name: "创建任务" }).click();
  const row = taskRow(page, name);
  await expect(row).toBeVisible();
  const href = await row.getByRole("link").getAttribute("href");
  const id = href?.split("/").at(-1);
  if (!id) throw new Error(`The row for ${name} has no task link`);
  return { id, name };
}

/** header 徽标显示的进行中任务数。别的用例建的任务也算在里面，断言时只比较前后的差。 */
export async function runningCount(page: Page) {
  // 读屏读到的完整说法；屏幕上的简短说法对读屏隐藏。
  const badge = page.getByText(/^进行中的任务 \d+ 个$/);
  await expect(badge).toBeAttached();
  return Number(/\d+/.exec((await badge.textContent()) ?? "")?.[0]);
}

export { expect };
