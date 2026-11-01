import { INJECTED_FAILURE_CODE } from "../../constants/demo-faults";
import type { DemoFaultInput } from "../../hooks/use-inject-demo-fault";
import type { DemoFault, DemoOperation } from "../../types/demo-fault";
import type { DemoTaskTranslator } from "../../types/translator";

/**
 * 故障表单能添加的故障类型，以及它们写进故障配置的字段（各类型的效果见 types/demo-fault.ts）。加一种类型时在这里
 * 加一行，在 `demo-task` 文案的 `faultForm.kinds` 下加它的名称，并在下面的 `describeFault` 里描述它。
 */
export const FAULT_KINDS = [
  {
    value: "latency",
    labelKey: "latency",
    fault: { kind: "latency", latencyMs: 2000 },
  },
  {
    value: "unexpected",
    labelKey: "unexpected",
    fault: { kind: "unexpected" },
  },
  {
    value: "4xx",
    labelKey: "clientError",
    fault: { kind: "httpStatus", status: 409 },
  },
  {
    value: "5xx",
    labelKey: "serverError",
    fault: { kind: "httpStatus", status: 503 },
  },
  {
    value: "errorOnSuccess",
    labelKey: "errorBody",
    fault: { kind: "errorOnSuccess", code: INJECTED_FAILURE_CODE },
  },
  { value: "malformed", labelKey: "malformed", fault: { kind: "malformed" } },
] as const satisfies readonly {
  value: string;
  /** `demo-task` 文案 `faultForm.kinds` 下的 key。 */
  labelKey: string;
  fault: Omit<DemoFaultInput, "operation" | "times">;
}[];
export type FaultKindOption = (typeof FAULT_KINDS)[number]["value"];

/** 表单的一次选择对应的故障配置；没写的字段由 `useInjectDemoFault` 补成“不生效”。 */
export function toFault(
  operation: DemoOperation,
  kind: FaultKindOption,
  times: number | null,
): DemoFaultInput {
  const option =
    FAULT_KINDS.find((item) => item.value === kind) ?? FAULT_KINDS[0];
  return { operation, ...option.fault, times };
}

/**
 * 故障列表里的一行说明。配置也可能来自 e2e 等其他来源，所以按字段判断，不按表单的类型。
 * 状态码、错误码和毫秒数按字符串传给 `t()`：按数字传会被格式化成带千分位的写法。
 */
export function describeFault(fault: DemoFault, t: DemoTaskTranslator) {
  const effect =
    fault.kind === "httpStatus"
      ? t("faultPanel.effects.status", { status: String(fault.status) })
      : fault.kind === "errorOnSuccess"
        ? t("faultPanel.effects.errorBody", {
            code: String(fault.code ?? INJECTED_FAILURE_CODE),
          })
        : fault.kind === "malformed"
          ? t("faultPanel.effects.malformed")
          : fault.kind === "unexpected"
            ? t("faultPanel.effects.unexpected")
            : fault.kind === "businessError"
              ? t("faultPanel.effects.businessError", {
                  code: String(fault.code),
                })
              : t("faultPanel.effects.latency", {
                  latencyMs: String(fault.latencyMs),
                });
  const times =
    fault.times === null
      ? t("faultForm.always")
      : t("faultPanel.timesLeft", { count: fault.times });
  return t("faultPanel.faultRow", {
    operation: fault.operation,
    effect,
    times,
  });
}
