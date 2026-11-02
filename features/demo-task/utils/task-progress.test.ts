import { describe, expect, test } from "vitest";

import { nextTaskStep, type TaskProgressState } from "./task-progress";

describe("Demo 生成器推进一步", () => {
  test("pending 进入 running 0%，之后每步加 25%，到 100% 后完成", () => {
    const steps = [];
    let task: TaskProgressState = {
      name: "狐狸",
      status: "pending",
      progress: 0,
    };
    for (;;) {
      const step = nextTaskStep(task);
      if (!step) break;
      steps.push(step);
      task = { ...task, ...step };
    }
    expect(steps).toStrictEqual([
      { status: "running", progress: 0, log: "开始生成" },
      { status: "running", progress: 25, log: "解析 prompt" },
      { status: "running", progress: 50, log: "生成网格" },
      { status: "running", progress: 75, log: "生成贴图" },
      { status: "running", progress: 100, log: "优化拓扑" },
      { status: "done", progress: 100, log: "生成完成" },
    ]);
  });

  test("名称里带 fail（不区分大小写）的任务在最后一步失败", () => {
    expect(
      nextTaskStep({
        name: "机甲 FAIL 测试",
        status: "running",
        progress: 100,
      }),
    ).toStrictEqual({
      status: "failed",
      progress: 100,
      log: "生成失败：材质计算出错",
    });
  });

  test("终态的任务不再推进", () => {
    expect(nextTaskStep({ name: "a", status: "done", progress: 100 })).toBe(
      null,
    );
    expect(nextTaskStep({ name: "a", status: "failed", progress: 100 })).toBe(
      null,
    );
  });
});
