"use client";

import { useMutation, useQuery } from "@/lib/react-query";

import { getMockLatencyQueryOptions } from "../../api/get-mock-latency";
import { updateMockLatencyMutationOptions } from "../../api/update-mock-latency";
import { OptionSelect } from "./option-select";

const PRESETS_MS = [0, 200, 500, 1000, 2000, 3000];

/** 业务接口的默认延迟，选中后立即生效。 */
export function DefaultLatencySelect() {
  const latency = useQuery(getMockLatencyQueryOptions());
  const update = useMutation(updateMockLatencyMutationOptions());

  if (latency.data !== undefined) {
    // Mock API 的当前值可能不在预设里（比如启动时传了别的值），补进选项才能显示出来。
    const values = PRESETS_MS.includes(latency.data)
      ? PRESETS_MS
      : [...PRESETS_MS, latency.data].sort((a, b) => a - b);
    return (
      <div className="mb-4 max-w-40">
        <OptionSelect
          label="默认延迟"
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
      {latency.error ? "读取默认延迟失败" : "读取默认延迟…"}
    </p>
  );
}
