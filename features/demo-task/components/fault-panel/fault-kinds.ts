import type { MockFault } from "../../api/get-mock-faults";
import { INJECTED_FAILURE_CODE } from "../../constants/mock-faults";
import type { MockFaultInput } from "../../hooks/use-inject-mock-fault";
import type { DemoTaskTranslator } from "../../types/translator";

/**
 * 故障表单能添加的故障类型，以及它们写进 Mock API 故障配置的字段。加一种类型时在这里加一行，
 * 在 `demo-task` 文案的 `faultForm.kinds` 下加它的名称，并在下面的 `describeFault` 里描述它。
 */
export const FAULT_KINDS = [
  { value: "latency", labelKey: "latency", fault: { latencyMs: 2000 } },
  { value: "4xx", labelKey: "clientError", fault: { status: 409 } },
  { value: "5xx", labelKey: "serverError", fault: { status: 503 } },
  {
    value: "code",
    labelKey: "errorBody",
    fault: { code: INJECTED_FAILURE_CODE },
  },
  { value: "malformed", labelKey: "malformed", fault: { malformed: true } },
] as const satisfies readonly {
  value: string;
  /** `demo-task` 文案 `faultForm.kinds` 下的 key。 */
  labelKey: string;
  fault: Omit<MockFaultInput, "method" | "path" | "times">;
}[];
export type FaultKind = (typeof FAULT_KINDS)[number]["value"];

/** 表单的一次选择对应的故障配置；没写的字段由 `useInjectMockFault` 补成“不生效”。 */
export function toFault(
  endpoint: string,
  kind: FaultKind,
  times: number | null,
): MockFaultInput {
  const [method, path] = endpoint.split(" ");
  const fault = FAULT_KINDS.find((item) => item.value === kind)?.fault;
  return { method, path, ...fault, times };
}

/**
 * 故障列表里的一行说明。配置也可能来自 e2e 等其他来源，所以按字段判断，不按表单的类型。
 * 状态码、错误码和毫秒数按字符串传给 `t()`：按数字传会被格式化成带千分位的写法。
 */
export function describeFault(fault: MockFault, t: DemoTaskTranslator) {
  const effect = fault.status
    ? t("faultPanel.effects.status", { status: String(fault.status) })
    : fault.code
      ? t("faultPanel.effects.errorBody", { code: String(fault.code) })
      : fault.malformed
        ? t("faultPanel.effects.malformed")
        : t("faultPanel.effects.latency", {
            latencyMs: String(fault.latencyMs),
          });
  const times =
    fault.times === null
      ? t("faultForm.always")
      : t("faultPanel.timesLeft", { count: fault.times });
  return t("faultPanel.faultRow", {
    method: fault.method,
    path: fault.path,
    effect,
    times,
  });
}
