import type { MockFault } from "../../api/get-mock-faults";
import { INJECTED_FAILURE_CODE } from "../../constants/mock-faults";
import type { MockFaultInput } from "../../hooks/use-inject-mock-fault";
import type { DemoTaskTranslator } from "../../types/translator";

/**
 * The fault kinds the fault form can add, and the fields each writes into the
 * Mock API's fault config. To add a kind, add a row here, its name under
 * `faultForm.kinds` in the `demo-task` messages, and its description in
 * `describeFault` below.
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
  /** The key under `faultForm.kinds` in the `demo-task` messages. */
  labelKey: string;
  fault: Omit<MockFaultInput, "method" | "path" | "times">;
}[];
export type FaultKind = (typeof FAULT_KINDS)[number]["value"];

/**
 * The fault config for one choice in the form; `useInjectMockFault` fills the
 * fields left out with values that have no effect.
 */
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
 * One line describing a fault in the fault list. A config can also come from
 * elsewhere, such as e2e, so this goes by its fields, not by the form's kinds.
 * Status codes, error codes and milliseconds go to `t()` as strings: as numbers
 * they would be formatted with thousands separators.
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
