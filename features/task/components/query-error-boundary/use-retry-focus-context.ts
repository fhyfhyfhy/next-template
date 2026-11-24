import { use } from "react";

import { RetryFocusContext } from "./context";

export function useRetryFocusContext() {
  const context = use(RetryFocusContext);
  if (!context) {
    throw new Error("FocusAfterRetry must be inside <QueryErrorBoundary>");
  }
  return context;
}
