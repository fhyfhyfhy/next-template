// Demo task 的业务规则里的数值。数据层按它们校验，表单和 Server Action 的校验文案也用它们，
// 浏览器里提前拦下的输入和服务端拒绝的输入才一致。

/** 名称去掉首尾空白后的最大长度。 */
export const TASK_NAME_MAX_LENGTH = 40;
/** prompt 去掉首尾空白后的最大长度。 */
export const TASK_PROMPT_MAX_LENGTH = 500;
/** 评论去掉首尾空白后的最大长度。 */
export const COMMENT_MAX_LENGTH = 500;
/** 列表一页的默认和最多条数。 */
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;
/** 搜索最多返回的条数。 */
export const SEARCH_LIMIT = 20;
/** 每推进一步增加的进度。 */
export const PROGRESS_STEP = 25;
/**
 * Demo generator 推进一步的间隔，也是详情页轮询运行中任务的间隔：一个任务从 pending 到终态走 6 步，约 9 秒，
 * 停在详情页能看到进度推进。
 */
export const TASK_STEP_INTERVAL_MS = 1500;
