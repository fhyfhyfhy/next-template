import type { MockFault } from "../../api/get-mock-faults";
import { INJECTED_FAILURE_CODE } from "../../constants/mock-faults";
import type { MockFaultInput } from "../../hooks/use-inject-mock-fault";

/**
 * 故障表单能添加的故障类型，以及它们写进 Mock API 故障配置的字段。加一种类型时在这里加一行，
 * 并在下面的 `describeFault` 里描述它。
 */
export const FAULT_KINDS = [
  { value: "latency", label: "再延迟 2 秒", fault: { latencyMs: 2000 } },
  { value: "4xx", label: "返回 4xx", fault: { status: 409 } },
  { value: "5xx", label: "返回 5xx", fault: { status: 503 } },
  {
    value: "code",
    label: "2xx 但返回 error",
    fault: { code: INJECTED_FAILURE_CODE },
  },
  {
    value: "malformed",
    label: "响应体不符合 schema",
    fault: { malformed: true },
  },
] as const satisfies readonly {
  value: string;
  label: string;
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

/** 故障列表里的一行说明。配置也可能来自 e2e 等其他来源，所以按字段判断，不按表单的类型。 */
export function describeFault(fault: MockFault) {
  const effect = fault.status
    ? `返回 ${fault.status}`
    : fault.code
      ? `2xx 但返回 error ${fault.code}`
      : fault.malformed
        ? "响应体不符合 schema"
        : `再延迟 ${fault.latencyMs}ms`;
  const times = fault.times === null ? "一直生效" : `还剩 ${fault.times} 次`;
  return `${fault.method} ${fault.path}：${effect}，${times}`;
}
