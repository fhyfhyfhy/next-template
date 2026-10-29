import { z } from "zod";

import { fetchApi } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

// Mock API 的控制接口，只给故障实验室使用；真实后端没有这组接口。

export const mockFaultSchema = z
  .object({
    method: z.string(),
    path: z.string(),
    latency_ms: z.number(),
    status: z.number().nullable(),
    code: z.number().nullable(),
    malformed: z.boolean(),
    times: z.number().nullable(),
  })
  .transform(({ latency_ms, ...fault }) => ({
    ...fault,
    latencyMs: latency_ms,
  }));
export type MockFault = z.infer<typeof mockFaultSchema>;

export const mockFaultListSchema = z.object({
  faults: z.array(mockFaultSchema),
});

const getMockFaults = () =>
  fetchApi({ url: "/__mock/faults", schema: mockFaultListSchema, auth: false });

export const getMockFaultsQueryOptions = () =>
  queryOptions({
    queryKey: ["demo-task", "mock-fault", "list"],
    queryFn: async () => (await getMockFaults()).faults,
  });
