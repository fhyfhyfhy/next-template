import { describe, expect, test } from "vitest";

import { advance } from "./db-test-helpers";
import {
  advanceActiveTasks,
  advanceTask,
  startTaskGenerator,
} from "./generator";
import { createTask, getTask } from "./tasks";

describe("Generator 推进任务", () => {
  test("一步步把任务从 pending 推进到 done，之后不再变化", async () => {
    const { id } = await createTask({ name: "推进测试", prompt: "一只狐狸" });

    const steps = [];
    for (let step = 0; step < 6; step += 1) {
      const task = await advanceTask(id);
      steps.push([task.status, task.progress]);
    }
    const after = await advanceTask(id);

    expect(steps).toStrictEqual([
      ["running", 0],
      ["running", 25],
      ["running", 50],
      ["running", 75],
      ["running", 100],
      ["done", 100],
    ]);
    expect([after.status, after.progress]).toStrictEqual(["done", 100]);
  });

  test("名称里带 fail 的任务最终失败", async () => {
    const { id } = await createTask({
      name: "Fail 推进测试",
      prompt: "一只狐狸",
    });
    expect((await advance(id, 6))?.status).toBe("failed");
  });

  test("每个活跃任务各推进一步，终态的任务不变", async () => {
    await advanceActiveTasks();
    expect((await getTask("task-11")).status).toBe("running");
    expect((await getTask("task-03")).progress).toBe(75);
    expect((await getTask("task-01")).status).toBe("done");
  });

  test("后台运行时自己推进到终态", async () => {
    const { id } = await createTask({ name: "自动推进", prompt: "一只狐狸" });
    const stop = startTaskGenerator({ intervalMs: 20 });
    try {
      await expect
        .poll(async () => (await getTask(id)).status, { timeout: 5000 })
        .toBe("done");
    } finally {
      await stop();
    }
  });
});
