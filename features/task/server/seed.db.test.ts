import { describe, expect, test } from "vitest";

import { getTaskDb } from "./connection";
import { resetBeforeEach } from "./db-test-helpers";
import { seedIfEmpty } from "./seed";
import { createTask, deleteTask, getTask, getTaskModelUrl } from "./tasks";

resetBeforeEach();

async function taskIds() {
  const rows = await getTaskDb().selectFrom("tasks").select("id").execute();
  return rows.map((row) => row.id);
}

/** 像用户那样逐个删掉全部任务：任务的封面和模型解除关联，上传记录留给清理任务。 */
async function deleteAllTasks() {
  for (const id of await taskIds()) await deleteTask(id);
}

describe("写入种子数据", () => {
  test("库里没有任务时写入全部种子任务，封面和模型重新关联", async () => {
    await deleteAllTasks();

    await seedIfEmpty();

    expect(await taskIds()).toHaveLength(20);
    expect((await getTask("task-01")).coverUrl).toMatch(/\/seed\/covers\//);
    expect(await getTaskModelUrl("task-01")).toMatch(/\/seed\/models\//);
  });

  test("库里还有任务时不写，不覆盖已有的数据", async () => {
    await deleteAllTasks();
    const { id } = await createTask({ name: "留下的任务", prompt: "一只狐狸" });

    await seedIfEmpty();

    expect(await taskIds()).toStrictEqual([id]);
  });

  test("两个调用同时写时只写入一份", async () => {
    await deleteAllTasks();

    await Promise.all([seedIfEmpty(), seedIfEmpty()]);

    expect(await taskIds()).toHaveLength(20);
  });
});
