import type { ApiErrorObject } from "./fetch";

/**
 * 服务端按业务规则拒绝一次读写时抛出，Route Handler 把它转成 `lib/request/fetch.ts` 解析的失败响应：HTTP `status`
 * 加 `{ error: { code, message, param?, params?, data? } }`；Server Action 把调用方要识别的错误作为
 * `{ ok: false, error }` 返回，`error` 是同一个对象。
 * `code` 是业务错误码，前三位等于 `status`；`message` 面向开发者和日志，UI 按 `code` 和 `params` 生成文案。
 */
export class DomainError extends Error {
  readonly status: number;
  readonly code: number;
  /** 出错的请求字段名。 */
  readonly param: string | undefined;
  /** 翻译文案需要的插值数据。 */
  readonly params: Record<string, string | number> | undefined;
  /**
   * 文案之外 UI 要展示的数据，比如挡住这次写操作的那些记录。只放 JSON 原生的值：浏览器拿到的是
   * `unknown`，按 `code` 用对应的 schema 解析。
   */
  readonly data: unknown;

  constructor(
    status: number,
    code: number,
    message: string,
    details: DomainErrorDetails = {},
  ) {
    super(message);
    this.name = "DomainError";
    this.status = status;
    this.code = code;
    this.param = details.param;
    this.params = details.params;
    this.data = details.data;
  }
}

/** `DomainError` 在 status、code 和 message 之外的字段，含义同它的同名字段。 */
export interface DomainErrorDetails {
  param?: string;
  params?: Record<string, string | number>;
  data?: unknown;
}

/** 没有专门含义的通用错误码。各 feature 自己的业务错误码放在它的 `constants/error-codes.ts`，值不能和这里重复。 */
export const ErrorCode = {
  BAD_REQUEST: 40000,
  UNAUTHORIZED: 40100,
  FORBIDDEN: 40300,
  NOT_FOUND: 40400,
  SERVER_ERROR: 50000,
} as const;

/** 请求参数不合法；有专门含义的参数错误传自己的 `code`。 */
export function badRequest(
  message: string,
  details?: DomainErrorDetails,
  code: number = ErrorCode.BAD_REQUEST,
) {
  return new DomainError(400, code, message, details);
}

export function notFound(message: string) {
  return new DomainError(404, ErrorCode.NOT_FOUND, message);
}

/** 操作需要 session，而请求没有带。 */
export function unauthorized(message: string) {
  return new DomainError(401, ErrorCode.UNAUTHORIZED, message);
}

/**
 * actor 看得到这条记录，但不能做这次写操作。actor 看不到的记录用 `notFound`，和不存在的记录一样回答：
 * 403 会让对方知道记录存在。
 */
export function forbidden(message: string) {
  return new DomainError(403, ErrorCode.FORBIDDEN, message);
}

/** 请求和资源的当前状态冲突，比如名称已被占用、任务不在可重试的状态。 */
export function conflict(
  code: number,
  message: string,
  details?: DomainErrorDetails,
) {
  return new DomainError(409, code, message, details);
}

/** 失败响应的 JSON 体，格式见 `lib/request/fetch.ts` 的 `errorSchema`。 */
export function errorBody(error: DomainError): { error: ApiErrorObject } {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.param === undefined ? {} : { param: error.param }),
      ...(error.params === undefined ? {} : { params: error.params }),
      ...(error.data === undefined ? {} : { data: error.data }),
    },
  };
}
