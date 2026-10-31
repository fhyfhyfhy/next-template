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

/** 请求失败时全局 handler 的行为，由 query 和 mutation 的 `meta` 传入。 */
// 下方 Register 要求 meta 类型可赋给 Record<string, unknown>，否则 TanStack 静默退回 Record<string, unknown>。
export interface HandleRequestErrorOptions extends Record<string, unknown> {
  /**
   * 不弹错误提示；传函数时按错误逐个判断。mutation 默认 `false`。
   * query 已有数据时默认 `false`：组件继续显示旧数据，提示是刷新失败的唯一信号；没有数据时默认 `true`，由组件渲染错误。
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

/** cache 由封装创建以保证全局错误处理，调用方不能传入自定义 cache。 */
export interface QueryClientOptions extends Omit<
  QueryClientConfig,
  "queryCache" | "mutationCache"
> {
  queryCache?: never;
  mutationCache?: never;
  /**
   * query 或 mutation 最终失败时调用（query 在重试用完后）。
   * query 默认只在已有数据时提示（见 `suppressErrorToast`）；`meta` 的字段逐个覆盖默认值。
   */
  onRequestError?: RequestErrorHandler;
}

// 基类方法自身的约束，取出来就不用在重写时再写一遍 MutationOptions<any, ...>。
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

  // 服务端的 client 按请求或按渲染创建，应随响应一起回收。有限的 gcTime 会挂一个 Node timer，
  // 它引用 Query、整个 QueryCache 和每个 queryFn 闭包，在触发前整次请求都无法回收。
  // 不传 gcTime 时服务端默认就是 Infinity，这里拦的是 queryOptions、hook 或 defaultOptions 显式传入的值。
  // 写进 defaultOptions 拦不住：defaultQueryOptions 把查询自己的选项展开在 defaultOptions 之后。
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
