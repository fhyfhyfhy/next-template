/**
 * 服务端按业务规则拒绝一次读写时抛出，Route Handler 把它转成 `lib/fetch.ts` 解析的失败响应：HTTP `status`
 * 加 `{ error: { code, message, param?, params? } }`；Server Action 把调用方要识别的 `code` 作为预期失败返回。
 * `code` 是业务错误码，前三位等于 `status`；`message` 面向开发者和日志，UI 按 `code` 和 `params` 生成文案。
 */
export class DomainError extends Error {
  readonly status: number;
  readonly code: number;
  /** 出错的请求字段名。 */
  readonly param: string | undefined;
  /** 翻译文案需要的插值数据。 */
  readonly params: Record<string, string | number> | undefined;

  constructor(
    status: number,
    code: number,
    message: string,
    details: {
      param?: string;
      params?: Record<string, string | number>;
    } = {},
  ) {
    super(message);
    this.name = "DomainError";
    this.status = status;
    this.code = code;
    this.param = details.param;
    this.params = details.params;
  }
}

/** 没有专门含义的通用错误码。各 feature 自己的业务错误码放在它的 `constants/error-codes.ts`，值不能和这里重复。 */
export const ErrorCode = {
  BAD_REQUEST: 40000,
  NOT_FOUND: 40400,
  SERVER_ERROR: 50000,
  SERVICE_UNAVAILABLE: 50300,
} as const;

/** 请求参数不合法；有专门含义的参数错误传自己的 `code`。 */
export function badRequest(
  message: string,
  details?: { param?: string; params?: Record<string, string | number> },
  code: number = ErrorCode.BAD_REQUEST,
) {
  return new DomainError(400, code, message, details);
}

export function notFound(message: string) {
  return new DomainError(404, ErrorCode.NOT_FOUND, message);
}

/** 请求和资源的当前状态冲突，比如名称已被占用、任务不在可重试的状态。 */
export function conflict(
  code: number,
  message: string,
  details?: { param?: string; params?: Record<string, string | number> },
) {
  return new DomainError(409, code, message, details);
}

/** 失败响应的 JSON 体，格式见 `lib/fetch.ts` 的 `errorSchema`。 */
export function errorBody(error: DomainError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.param === undefined ? {} : { param: error.param }),
      ...(error.params === undefined ? {} : { params: error.params }),
    },
  };
}
