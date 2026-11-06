import { demoRoute } from "@/features/demo-faults/server";
import { getTask } from "@/features/demo-task/server";

export const GET = demoRoute(
  async (_request, { params }: RouteContext<"/api/demo/tasks/[id]">) =>
    getTask((await params).id),
);
