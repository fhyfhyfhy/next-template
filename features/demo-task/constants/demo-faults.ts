import type { DemoOperation } from "../types/demo-fault";

/** 故障实验室注入“2xx 但响应体只有 error 对象”时默认的 code，不对应任何真实的业务错误。 */
export const INJECTED_FAILURE_CODE = 50010;

/** 故障实验室的实验都打在任务详情的读取上：浏览器经 Route Handler 读详情，HTTP 专属的故障也能演示。 */
export const TASK_DETAIL_OPERATION: DemoOperation = "task.get";
