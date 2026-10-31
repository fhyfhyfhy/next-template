"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { useInjectMockFault } from "../../hooks/use-inject-mock-fault";
import { FAULT_KINDS, type FaultKind, toFault } from "./fault-kinds";
import { OptionSelect } from "./option-select";

const ENDPOINTS = [
  "GET /demo/tasks",
  "GET /demo/tasks/:id",
  "GET /demo/tasks/search",
  "GET /demo/feed",
  "GET /demo/tasks/:id/comments",
  "POST /demo/tasks",
  "PATCH /demo/tasks/:id",
  "PUT /demo/tasks/:id/favorite",
  "POST /demo/tasks/:id/retry",
  "DELETE /demo/tasks/:id",
  "PUT /demo/tasks/:id/cover",
  "GET /demo/tasks/:id/model",
  "POST /demo/tasks/:id/comments",
  "DELETE /demo/tasks/:id/comments/:commentId",
] as const;
type Endpoint = (typeof ENDPOINTS)[number];

const TIMES = ["1", "3", "always"] as const;
type Times = (typeof TIMES)[number];

export function FaultForm() {
  const t = useTranslations("demo-task.faultForm");
  const injectFault = useInjectMockFault();
  const [endpoint, setEndpoint] = useState<Endpoint>("GET /demo/tasks/:id");
  const [kind, setKind] = useState<FaultKind>("latency");
  const [times, setTimes] = useState<Times>("always");
  const [pending, setPending] = useState(false);
  return (
    <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
      <OptionSelect
        label={t("endpoint")}
        value={endpoint}
        options={ENDPOINTS.map((value) => ({ value, label: value }))}
        onChange={setEndpoint}
      />
      <OptionSelect
        label={t("kind")}
        value={kind}
        options={FAULT_KINDS.map(({ value, labelKey }) => ({
          value,
          label: t(`kinds.${labelKey}`),
        }))}
        onChange={setKind}
      />
      <OptionSelect
        label={t("times")}
        value={times}
        options={TIMES.map((value) => ({
          value,
          label:
            value === "always"
              ? t("always")
              : t("nextTimes", { count: Number(value) }),
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
                endpoint,
                kind,
                times === "always" ? null : Number(times),
              ),
            );
          } finally {
            setPending(false);
          }
        }}
      >
        {t("submit")}
      </Button>
    </div>
  );
}
