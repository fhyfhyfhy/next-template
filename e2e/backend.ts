import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";

import { localEnv } from "../scripts/local-services/datasets.mjs";
import { expect, test as base } from "./test";

// 用例在浏览器里观察应用，测试数据直接写进 e2e 数据集（playwright.config.ts 的 webServer 用的同一个库），不经过应用。
// 这里的写入对应用来说就是“别处改了数据”：不让 Next 的服务端缓存失效，页面按自己的新鲜度规则才看到变化。
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
}

// 应用的 SSE 日志流监听这个频道（features/task/server/task-events.ts），任务变化后发通知，页面才收到新日志。
const TASK_CHANGED_CHANNEL = "task_changed";

/** 名称和 prompt 后面接一段随机串：用例之间、复用服务多跑几轮时都不会撞名，也不会被别的用例的搜索搜到。 */
export function unique(label: string) {
  return `${label} ${randomUUID().slice(0, 6)}`;
}

export interface CreatedTask {
  id: string;
  name: string;
  prompt: string;
}

export class Backend {
  readonly db: Kysely<Tables>;

  constructor(connectionString: string) {
    this.db = new Kysely<Tables>({
      dialect: new PostgresDialect({
        pool: new pg.Pool({ connectionString, max: 2 }),
      }),
    });
  }

  /** 新建一个任务，默认排队中、没有封面。`createdAt` 决定它在按创建时间排序的列表里的位置。 */
  async createTask({
    name = unique("e2e 任务"),
    prompt = unique("e2e prompt"),
    status = "pending",
    progress = status === "done" || status === "failed" ? 100 : 0,
    createdAt = new Date(),
  }: {
    name?: string;
    prompt?: string;
    status?: TaskStatus;
    progress?: number;
    createdAt?: Date;
  } = {}): Promise<CreatedTask> {
    const id = `e2e-${randomUUID()}`;
    await this.db
      .insertInto("tasks")
      .values({
        id,
        name,
        prompt,
        status,
        progress,
        favorite: false,
        created_at: createdAt,
        updated_at: createdAt,
      })
      .execute();
    return { id, name, prompt };
  }

  async addComments(taskId: string, contents: string[]) {
    const now = Date.now();
    await this.db
      .insertInto("task_comments")
      .values(
        contents.map((content, index) => ({
          id: `e2e-${randomUUID()}`,
          task_id: taskId,
          content,
          created_at: new Date(now + index),
        })),
      )
      .execute();
  }

  /** 像生成服务那样报告一次进度：更新状态和进度，写一条生成日志，并通知正在推送日志的页面。 */
  async reportProgress(
    taskId: string,
    {
      status,
      progress,
      log,
    }: { status: TaskStatus; progress: number; log: string },
  ) {
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
      await notifyTaskChanged(trx, taskId);
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
      await notifyTaskChanged(trx, taskId);
    });
  }

  async deleteTask(taskId: string) {
    await this.db.transaction().execute(async (trx) => {
      // 评论和日志随外键删除。
      await trx.deleteFrom("tasks").where("id", "=", taskId).execute();
      await notifyTaskChanged(trx, taskId);
    });
  }

  /**
   * 锁住一张表，直到调用返回的函数：服务端对这张表的读取一直等着，用来拖慢页面里的某一段数据。
   * 用自己的连接拿锁，不占连接池。
   */
  async holdTable(table: keyof Tables) {
    const client = new pg.Client({
      connectionString: localEnv("e2e").DATABASE_URL,
    });
    await client.connect();
    await client.query("begin");
    await client.query(`lock table ${pg.escapeIdentifier(table)}`);
    return async () => {
      await client.query("rollback");
      await client.end();
    };
  }
}

function notifyTaskChanged(trx: Kysely<Tables>, taskId: string) {
  return sql`select pg_notify(${TASK_CHANGED_CHANNEL}, ${taskId})`.execute(trx);
}

/** `backend` 在每个 worker 里连一次 e2e 数据集。 */
export const test = base.extend<object, { backend: Backend }>({
  backend: [
    async ({}, use) => {
      const backend = new Backend(localEnv("e2e").DATABASE_URL);
      await use(backend);
      await backend.db.destroy();
    },
    { scope: "worker" },
  ],
});

/**
 * 从当前的任务页面经导航栏客户端导航到 `url`。整页加载后，服务端渲染的控件要等 hydrate 才响应点击；
 * 客户端导航在浏览器里渲染整页，没有要等 hydrate 的部分，到达后就能操作。导航栏的进行中徽标只在浏览器里请求，
 * 它和导航链接在同一个 Suspense 边界里，徽标出现说明链接已经 hydrate，点击是客户端导航。
 */
export async function navigateThroughHeader(
  page: Page,
  link: string,
  url: string,
) {
  await expect(page.getByLabel(/^进行中的任务 \d+ 个$/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("link", { name: link })
    .click();
  await expect(page).toHaveURL(url);
}

/** header 徽标显示的进行中任务数。别的用例建的任务也算在里面，断言时只比较前后的差。 */
export async function runningCount(page: Page) {
  const badge = page.getByLabel(/^进行中的任务 \d+ 个$/);
  await expect(badge).toBeVisible();
  const label = (await badge.getAttribute("aria-label")) ?? "";
  return Number(/\d+/.exec(label)?.[0]);
}

export { expect };
