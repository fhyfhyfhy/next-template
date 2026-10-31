import { z } from "zod";

import { fetchApi } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

// Mock API 的控制接口，只给故障实验室使用；真实后端没有这个接口。

/** 业务接口的默认延迟（毫秒）。 */
export const mockLatencySchema = z
  .object({ latency_ms: z.number() })
  .transform(({ latency_ms }) => latency_ms);

const getMockLatency = () =>
  fetchApi({ url: "/__mock/latency", schema: mockLatencySchema, auth: false });

export const getMockLatencyQueryOptions = () =>
  queryOptions({
    queryKey: ["demo-task", "mock-latency", "detail"],
    queryFn: getMockLatency,
  });
