"use client";

import { catchError, type ErrorInfo } from "next/error";

import { ErrorMessage, type QueryErrorBoundaryProps } from "./error-message";

/**
 * A local error boundary for a `useSuspenseQuery` whose first load fails, so
 * the error doesn't bubble up to the route's error.tsx and replace the whole
 * page. A failed background refresh of a query that has data never gets here;
 * the global toast rules cover it.
 */
export const QueryErrorBoundary = catchError(function QueryErrorFallback(
  { message }: QueryErrorBoundaryProps,
  { retry }: ErrorInfo,
) {
  return <ErrorMessage message={message} retry={retry} />;
});
