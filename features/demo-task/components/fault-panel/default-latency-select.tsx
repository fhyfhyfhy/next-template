"use client";

import { useTranslations } from "next-intl";

import { useMutation, useQuery } from "@/lib/react-query";

import { getMockLatencyQueryOptions } from "../../api/get-mock-latency";
import { updateMockLatencyMutationOptions } from "../../api/update-mock-latency";
import { OptionSelect } from "./option-select";

const PRESETS_MS = [0, 200, 500, 1000, 2000, 3000];

/**
 * The default latency of the business endpoints; a choice takes effect at once.
 */
export function DefaultLatencySelect() {
  const t = useTranslations("demo-task.defaultLatency");
  const latency = useQuery(getMockLatencyQueryOptions());
  const update = useMutation(updateMockLatencyMutationOptions());

  if (latency.data !== undefined) {
    // The Mock API's current value may not be a preset (it may have been
    // started with another value); add it to the options so it can show.
    const values = PRESETS_MS.includes(latency.data)
      ? PRESETS_MS
      : [...PRESETS_MS, latency.data].sort((a, b) => a - b);
    return (
      <div className="mb-4 max-w-40">
        <OptionSelect
          label={t("label")}
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
      {latency.error ? t("readFailed") : t("reading")}
    </p>
  );
}
