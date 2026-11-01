import {
  type DefaultedQueryObserverOptions,
  type DefaultError,
  environmentManager,
  MutationCache,
  QueryCache,
  QueryClient as TanstackQueryClient,
  type QueryClientConfig,
  type QueryKey,
  type QueryObserverOptions,
} from "@tanstack/react-query";

export type {
  DehydratedState,
  InfiniteData,
  QueryKey,
} from "@tanstack/react-query";
export {
  defaultShouldDehydrateQuery,
  dehydrate,
  environmentManager,
  HydrationBoundary,
  infiniteQueryOptions,
  keepPreviousData,
  mutationOptions,
  noop,
  QueryClientProvider,
  QueryErrorResetBoundary,
  queryOptions,
  skipToken,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  useQueryErrorResetBoundary,
  useSuspenseQuery,
} from "@tanstack/react-query";

/** What the global handler does when a request fails, passed in a query's or mutation's `meta`. */
// Register below needs the meta type to be assignable to Record<string, unknown>; otherwise TanStack
// silently falls back to Record<string, unknown>.
export interface HandleRequestErrorOptions extends Record<string, unknown> {
  /**
   * Shows no error toast; a function decides per error. `false` by default for a mutation.
   * For a query, `false` by default when it has data: the component keeps showing the old data, so the
   * toast is the only sign the refresh failed; `true` by default when it has none, as the component
   * renders the error.
   */
  suppressErrorToast?: boolean | ((error: unknown) => boolean);
}

export type RequestErrorHandler = (
  error: unknown,
  options: HandleRequestErrorOptions,
) => void;

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: HandleRequestErrorOptions;
    mutationMeta: HandleRequestErrorOptions;
  }
}

/** The wrapper creates the caches to guarantee global error handling, so a caller cannot pass its own. */
export interface QueryClientOptions extends Omit<
  QueryClientConfig,
  "queryCache" | "mutationCache"
> {
  queryCache?: never;
  mutationCache?: never;
  /**
   * Called when a query or mutation finally fails (a query once its retries are used up).
   * By default a query shows a toast only when it has data (see `suppressErrorToast`); each field of
   * `meta` overrides its default.
   */
  onRequestError?: RequestErrorHandler;
}

// The base class method's own constraint, taken from it so the override need not spell out
// MutationOptions<any, ...> again.
type AnyMutationOptions = NonNullable<
  Parameters<TanstackQueryClient["defaultMutationOptions"]>[0]
>;

export class QueryClient extends TanstackQueryClient {
  constructor({
    onRequestError,
    queryCache,
    mutationCache,
    ...config
  }: QueryClientOptions = {}) {
    if (queryCache !== undefined || mutationCache !== undefined) {
      throw new TypeError(
        "QueryClient does not accept queryCache or mutationCache; use onRequestError for global error handling.",
      );
    }
    super({
      queryCache: new QueryCache({
        onError: (error, query) =>
          onRequestError?.(error, {
            suppressErrorToast: query.state.data === undefined,
            ...query.meta,
          }),
      }),
      mutationCache: new MutationCache({
        onError: (error, _variables, _onMutateResult, mutation) =>
          onRequestError?.(error, { ...mutation.meta }),
      }),
      ...config,
    });
  }

  // A server client is created per request or per render and should be collected with the response.
  // A finite gcTime sets a Node timer that holds the Query, the whole QueryCache and every queryFn
  // closure, so nothing of the request can be collected until it fires. Without a gcTime the server
  // default is already Infinity; this catches values passed explicitly by queryOptions, a hook or
  // defaultOptions. Setting it in defaultOptions would not: defaultQueryOptions spreads the query's
  // own options after defaultOptions.
  defaultQueryOptions<
    TQueryFnData = unknown,
    TError = DefaultError,
    TData = TQueryFnData,
    TQueryData = TQueryFnData,
    TQueryKey extends QueryKey = QueryKey,
    TPageParam = never,
  >(
    options:
      | QueryObserverOptions<
          TQueryFnData,
          TError,
          TData,
          TQueryData,
          TQueryKey,
          TPageParam
        >
      | DefaultedQueryObserverOptions<
          TQueryFnData,
          TError,
          TData,
          TQueryData,
          TQueryKey
        >,
  ): DefaultedQueryObserverOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  > {
    const defaulted = super.defaultQueryOptions(options);
    if (environmentManager.isServer()) defaulted.gcTime = Infinity;
    return defaulted;
  }

  defaultMutationOptions<T extends AnyMutationOptions>(options?: T): T {
    const defaulted = super.defaultMutationOptions(options);
    if (environmentManager.isServer()) defaulted.gcTime = Infinity;
    return defaulted;
  }
}
