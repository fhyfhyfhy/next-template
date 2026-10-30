"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { INJECTED_FAILURE_CODE } from "../../constants/mock-faults";
import {
  type MockFaultInput,
  useInjectMockFault,
} from "../../hooks/use-inject-mock-fault";
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

const KINDS = [
  { value: "latency", label: "再延迟 2 秒" },
  { value: "4xx", label: "返回 4xx" },
  { value: "5xx", label: "返回 5xx" },
  { value: "code", label: "2xx 但返回 error" },
  { value: "malformed", label: "响应体不符合 schema" },
] as const;
type Kind = (typeof KINDS)[number]["value"];

const TIMES = [
  { value: "1", label: "下 1 次" },
  { value: "3", label: "下 3 次" },
  { value: "always", label: "一直生效" },
] as const;
type Times = (typeof TIMES)[number]["value"];

function toFault(endpoint: Endpoint, kind: Kind, times: Times): MockFaultInput {
  const [method, path] = endpoint.split(" ");
  return {
    method,
    path,
    latencyMs: kind === "latency" ? 2000 : 0,
    status: kind === "5xx" ? 503 : kind === "4xx" ? 409 : null,
    code: kind === "code" ? INJECTED_FAILURE_CODE : null,
    malformed: kind === "malformed",
    times: times === "always" ? null : Number(times),
  };
}

export function FaultForm() {
  const injectFault = useInjectMockFault();
  const [endpoint, setEndpoint] = useState<Endpoint>("GET /demo/tasks/:id");
  const [kind, setKind] = useState<Kind>("latency");
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
        options={KINDS}
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
            await injectFault(toFault(endpoint, kind, times));
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
