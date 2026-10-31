"use client";

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

const TIMES = [
  { value: "1", label: "下 1 次" },
  { value: "3", label: "下 3 次" },
  { value: "always", label: "一直生效" },
] as const;
type Times = (typeof TIMES)[number]["value"];

export function FaultForm() {
  const injectFault = useInjectMockFault();
  const [endpoint, setEndpoint] = useState<Endpoint>("GET /demo/tasks/:id");
  const [kind, setKind] = useState<FaultKind>("latency");
  const [times, setTimes] = useState<Times>("always");
  const [pending, setPending] = useState(false);
  return (
    <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
      <OptionSelect
        label="接口"
        value={endpoint}
        options={ENDPOINTS.map((value) => ({ value, label: value }))}
        onChange={setEndpoint}
      />
      <OptionSelect
        label="故障"
        value={kind}
        options={FAULT_KINDS}
        onChange={setKind}
      />
      <OptionSelect
        label="次数"
        value={times}
        options={TIMES}
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
        添加故障
      </Button>
    </div>
  );
}
