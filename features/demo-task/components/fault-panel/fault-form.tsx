"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { useInjectDemoFault } from "../../hooks/use-inject-demo-fault";
import {
  type DemoOperation,
  demoOperationSchema,
} from "../../types/demo-fault";
import { FAULT_KINDS, type FaultKindOption, toFault } from "./fault-kinds";
import { OptionSelect } from "./option-select";

const OPERATIONS = demoOperationSchema.options;

const TIMES = ["1", "3", "always"] as const;
type Times = (typeof TIMES)[number];

export function FaultForm() {
  const t = useTranslations("demo-task");
  const injectFault = useInjectDemoFault();
  const [operation, setOperation] = useState<DemoOperation>("task.get");
  const [kind, setKind] = useState<FaultKindOption>("latency");
  const [times, setTimes] = useState<Times>("always");
  const [pending, setPending] = useState(false);
  return (
    <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
      <OptionSelect
        label={t("faultForm.operation")}
        value={operation}
        options={OPERATIONS.map((value) => ({ value, label: value }))}
        onChange={setOperation}
      />
      <OptionSelect
        label={t("faultForm.kind")}
        value={kind}
        options={FAULT_KINDS.map(({ value, labelKey }) => ({
          value,
          label: t(`faultForm.kinds.${labelKey}`),
        }))}
        onChange={setKind}
      />
      <OptionSelect
        label={t("faultForm.times")}
        value={times}
        options={TIMES.map((value) => ({
          value,
          label:
            value === "always"
              ? t("faultForm.always")
              : t("faultForm.nextTimes", { count: Number(value) }),
        }))}
        onChange={setTimes}
      />
      <Button
        size="sm"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await injectFault(
              toFault(
                operation,
                kind,
                times === "always" ? null : Number(times),
              ),
            );
          } finally {
            setPending(false);
          }
        }}
      >
        {t("faultForm.submit")}
      </Button>
    </div>
  );
}
