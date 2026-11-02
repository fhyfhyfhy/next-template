/** 故障实验室注入“2xx 但返回 error 对象”时用的 code，不对应 Mock API 的任何真实业务错误。 */
export const INJECTED_FAILURE_CODE = 50010;

/** 故障实验室的实验都打在任务详情接口上。故障按“方法 + 路由模式”匹配，不区分任务 id。 */
export const TASK_DETAIL_ROUTE = "/demo/tasks/:id";
