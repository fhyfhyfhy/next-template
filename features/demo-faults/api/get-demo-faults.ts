import { fetchApi } from "@/lib/fetch";
import { queryOptions } from "@/lib/react-query";

import { demoFaultListSchema } from "../types/demo-fault";

// Demo backend 的控制接口，只给故障实验室使用；真实项目没有这组接口。

const getDemoFaults = async () =>
  (
    await fetchApi({
      url: "/api/demo/control/faults",
      schema: demoFaultListSchema,
    })
  ).faults;

export const getDemoFaultsQueryOptions = () =>
  queryOptions({
    queryKey: ["demo-faults", "fault", "list"],
    queryFn: getDemoFaults,
  });
