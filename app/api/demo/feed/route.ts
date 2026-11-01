import { demoRoute, integerParam, listFeed } from "@/features/demo-task/server";

/** 作品广场：`cursor` 是上一页返回的 `nextCursor`，不传时从第一页开始；`limit` 是每页条数。 */
export const GET = demoRoute(async (request) => {
  const params = new URL(request.url).searchParams;
  return listFeed(params.get("cursor"), integerParam(params, "limit") ?? 10);
});
