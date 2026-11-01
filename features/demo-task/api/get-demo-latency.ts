import { z } from "zod";

import { fetchApi } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

// Demo 后端的控制接口，只给故障实验室使用；真实项目没有这个接口。

const latencySchema = z.object({ latencyMs: z.number() });

const getDemoLatency = async () =>
  (
    await fetchApi({
      url: "/api/demo/control/latency",
      schema: latencySchema,
    })
  ).latencyMs;

/** 业务操作的默认延迟（毫秒）。 */
export const getDemoLatencyQueryOptions = () =>
  queryOptions({
    queryKey: ["demo-task", "demo-latency", "detail"],
    queryFn: getDemoLatency,
  });
