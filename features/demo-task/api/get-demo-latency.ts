import { fetchApi } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

import { demoLatencySchema } from "../types/demo-fault";

// Demo 后端的控制接口，只给故障实验室使用；真实项目没有这个接口。

const getDemoLatency = async () =>
  (
    await fetchApi({
      url: "/api/demo/control/latency",
      schema: demoLatencySchema,
    })
  ).latencyMs;

/** 业务操作的默认延迟（毫秒）。 */
export const getDemoLatencyQueryOptions = () =>
  queryOptions({
    queryKey: ["demo-task", "demo-latency", "detail"],
    queryFn: getDemoLatency,
  });
