import { PROGRESS_STEP } from "../constants/task-rules";
import type { TaskStatus } from "../types/task-filters";

const RUNNING_LOGS = ["解析 prompt", "生成网格", "生成贴图", "优化拓扑"];

export interface TaskProgressState {
  name: string;
  status: TaskStatus;
  progress: number;
}

export interface TaskStep {
  status: TaskStatus;
  progress: number;
  /** 这一步写入的生成日志。 */
  log: string;
}

/**
 * generator 推进一步之后的状态：pending → running 0% → 每步加 25% → 100% 之后进入终态。名称里带 "fail"
 * （不区分大小写）的任务进入 failed，其他进入 done。已在终态的任务返回 null。从 pending 到终态一共 6 步。
 */
export function nextTaskStep(task: TaskProgressState): TaskStep | null {
  if (task.status === "done" || task.status === "failed") return null;
  if (task.status === "pending") {
    return { status: "running", progress: 0, log: "开始生成" };
  }
  if (task.progress < 100) {
    const progress = Math.min(task.progress + PROGRESS_STEP, 100);
    return {
      status: "running",
      progress,
      log: RUNNING_LOGS[progress / PROGRESS_STEP - 1] ?? "生成中",
    };
  }
  if (/fail/i.test(task.name)) {
    return { status: "failed", progress: 100, log: "生成失败：材质计算出错" };
  }
  return { status: "done", progress: 100, log: "生成完成" };
}

export function isTerminalStatus(status: TaskStatus) {
  return status === "done" || status === "failed";
}
