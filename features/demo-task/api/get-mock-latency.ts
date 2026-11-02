import { z } from "zod";

import { fetchApi } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

// A Mock API control endpoint, used only by the Fault lab; a real backend
// doesn't have it.

/** The default latency of the business endpoints, in milliseconds. */
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
