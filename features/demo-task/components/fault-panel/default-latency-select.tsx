"use client";

import { useTranslations } from "next-intl";

import { useMutation, useQuery } from "@/lib/react-query";

import { getDemoLatencyQueryOptions } from "../../api/get-demo-latency";
import { updateDemoLatencyMutationOptions } from "../../api/update-demo-latency";
import { OptionSelect } from "./option-select";

const PRESETS_MS = [0, 200, 500, 1000, 2000, 3000];

/** 业务操作的默认延迟，选中后立即生效。 */
export function DefaultLatencySelect() {
  const t = useTranslations("demo-task");
  const latency = useQuery(getDemoLatencyQueryOptions());
  const update = useMutation(updateDemoLatencyMutationOptions(t));

  if (latency.data !== undefined) {
    // 当前值可能不在预设里（比如经控制接口设成了别的值），补进选项才能显示出来。
    const values = PRESETS_MS.includes(latency.data)
      ? PRESETS_MS
      : [...PRESETS_MS, latency.data].sort((a, b) => a - b);
    return (
      <div className="mb-4 max-w-40">
        <OptionSelect
          label={t("defaultLatency.label")}
          value={String(latency.data)}
          options={values.map((value) => ({
            value: String(value),
            label: `${value}ms`,
          }))}
          onChange={(value) => update.mutate(Number(value))}
        />
      </div>
    );
  }
  return (
    <p className="mb-4 text-sm text-muted-foreground">
      {latency.error
        ? t("defaultLatency.readFailed")
        : t("defaultLatency.reading")}
    </p>
  );
}
