import { getTask } from "@/features/task/server";
import { routeHandler } from "@/lib/request/route-handler";

export const GET = routeHandler(
  async (_request, { params }: RouteContext<"/api/tasks/[id]">) =>
    getTask((await params).id),
);
