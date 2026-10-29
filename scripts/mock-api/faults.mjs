import {
  badRequest,
  businessError,
  httpError,
  malformedSuccess,
} from "./envelope.mjs";
import { DomainError } from "./store.mjs";

const MAX_LATENCY_MS = 30_000;

/**
 * 注入到业务接口的故障，由故障实验室面板和 e2e 通过 `/__mock/faults` 配置。
 * 按“方法 + 路由模式”匹配，同一个接口只取第一条；`times` 为 null 时一直生效，否则用完即删除。
 */
export function createFaults() {
  let faults = [];

  return {
    list() {
      return faults.map(toWireFault);
    },

    replace(input) {
      if (!Array.isArray(input)) {
        throw new DomainError(badRequest("faults 必须是数组"));
      }
      faults = input.map(parseFault);
    },

    clear() {
      faults = [];
    },

    /** 取出这次请求要应用的故障并扣减次数；没有匹配的故障时返回 null。 */
    take(method, pattern) {
      const fault = faults.find(
        (candidate) =>
          candidate.method === method && candidate.path === pattern,
      );
      if (!fault) return null;
      if (fault.times !== null) {
        fault.times -= 1;
        if (fault.times === 0) faults = faults.filter((item) => item !== fault);
      }
      return fault;
    },
  };
}

/** 故障对应的响应；只加延迟的故障返回 null，请求照常处理。 */
export function faultResponse(fault) {
  if (fault.status !== null) {
    return httpError(fault.status, `Mock API 注入的 ${fault.status} 错误`);
  }
  if (fault.code !== null) {
    return businessError(fault.code, `Mock API 注入的业务错误 ${fault.code}`);
  }
  if (fault.malformed) return malformedSuccess();
  return null;
}

function parseFault(input) {
  const fault = {
    method: typeof input?.method === "string" ? input.method.toUpperCase() : "",
    path: typeof input?.path === "string" ? input.path : "",
    latencyMs: input?.latency_ms ?? 0,
    status: input?.status ?? null,
    code: input?.code ?? null,
    malformed: input?.malformed === true,
    times: input?.times ?? null,
  };
  const valid =
    fault.method !== "" &&
    fault.path.startsWith("/demo/") &&
    Number.isInteger(fault.latencyMs) &&
    fault.latencyMs >= 0 &&
    fault.latencyMs <= MAX_LATENCY_MS &&
    (fault.status === null ||
      (Number.isInteger(fault.status) &&
        fault.status >= 400 &&
        fault.status <= 599)) &&
    (fault.code === null ||
      (Number.isInteger(fault.code) && fault.code !== 0)) &&
    (fault.times === null ||
      (Number.isInteger(fault.times) && fault.times > 0));
  if (!valid) {
    throw new DomainError(
      badRequest(
        "故障配置不合法：path 必须是 /demo/ 下的路由模式，status 为 4xx 或 5xx，code 非 0，times 为正整数",
      ),
    );
  }
  return fault;
}

function toWireFault(fault) {
  return {
    method: fault.method,
    path: fault.path,
    latency_ms: fault.latencyMs,
    status: fault.status,
    code: fault.code,
    malformed: fault.malformed,
    times: fault.times,
  };
}
