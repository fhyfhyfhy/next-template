import { listComments } from "@/features/task/server";
import { routeHandler } from "@/lib/route-handler";

export const GET = routeHandler(
  async (_request, { params }: RouteContext<"/api/tasks/[id]/comments">) => ({
    items: await listComments((await params).id),
  }),
);
