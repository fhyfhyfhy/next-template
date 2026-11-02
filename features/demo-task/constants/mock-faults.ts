/**
 * The code the Fault lab uses to inject "2xx with an error object"; it matches
 * none of the Mock API's real business errors.
 */
export const INJECTED_FAILURE_CODE = 50010;

/**
 * Every Fault lab experiment targets the task detail endpoint. Faults match by
 * method plus route pattern, whatever the task id.
 */
export const TASK_DETAIL_ROUTE = "/demo/tasks/:id";
