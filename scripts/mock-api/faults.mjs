import {
  badRequest,
  errorOnSuccess,
  httpError,
  malformedSuccess,
} from "./responses.mjs";
import { DomainError } from "./store.mjs";

export const MAX_LATENCY_MS = 30_000;

/**
 * Faults injected into the business endpoints, set through `/__mock/faults` by the Fault lab
 * panel and e2e. A fault matches on method and route pattern, and only the first match for an
 * endpoint applies; with `times` null it stays in effect, otherwise it is removed once used up.
 */
export function createFaults() {
  let faults = [];

  return {
    list() {
      return faults.map(toWireFault);
    },

    replace(input) {
      if (!Array.isArray(input)) {
        throw new DomainError(badRequest("faults must be an array"));
      }
      faults = input.map(parseFault);
    },

    clear() {
      faults = [];
    },

    /** Takes the fault to apply to this request and counts one use; null when none matches. */
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

/** The fault's response; null for a latency-only fault, so the request is handled as usual. */
export function faultResponse(fault) {
  if (fault.status !== null) {
    return httpError(fault.status, `Injected ${fault.status} error`);
  }
  if (fault.code !== null) {
    return errorOnSuccess(fault.code, `Injected error code ${fault.code}`);
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
    (fault.code === null || Number.isInteger(fault.code)) &&
    (fault.times === null ||
      (Number.isInteger(fault.times) && fault.times > 0));
  if (!valid) {
    throw new DomainError(
      badRequest(
        "Invalid fault: path must be a route pattern under /demo/, status 4xx or 5xx, code an integer, and times a positive integer",
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
