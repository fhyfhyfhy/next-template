import { listFeed } from "@/features/task/server";
import { integerParam, routeHandler } from "@/lib/route-handler";

/** 作品广场：`cursor` 是上一页返回的 `nextCursor`，不传时从第一页开始；`limit` 是每页条数，不传时用数据层的默认值。 */
export const GET = routeHandler(async (request) => {
  const params = new URL(request.url).searchParams;
  return listFeed(params.get("cursor"), integerParam(params, "limit"));
});
