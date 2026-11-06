import type { DemoOperation } from "@/features/demo-faults";

/** 故障实验室的实验都打在任务详情的读取上：浏览器经 Route Handler 读详情，HTTP 专属的故障也能演示。 */
export const TASK_DETAIL_OPERATION: DemoOperation = "task.get";
