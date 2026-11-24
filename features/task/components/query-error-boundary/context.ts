import { createContext } from "react";

/** `QueryErrorBoundary` 提供给 `ErrorMessage` 和 `FocusAfterRetry` 的“刚点过重试”标志。 */
export interface RetryFocusValue {
  /** 点重试时调用，早于边界重新渲染内容。 */
  markRetried: () => void;
  /** 取走标志：刚点过重试时返回 true 并清掉，所以重试后只有先挂载的 `FocusAfterRetry` 拿到 true。 */
  takeRetried: () => boolean;
}

export const RetryFocusContext = createContext<RetryFocusValue | null>(null);
