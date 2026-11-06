import { demoRoute } from "@/features/demo-faults/server";
import { listComments } from "@/features/demo-task/server";

export const GET = demoRoute(
  async (
    _request,
    { params }: RouteContext<"/api/demo/tasks/[id]/comments">,
  ) => ({
    items: await listComments((await params).id),
  }),
);
