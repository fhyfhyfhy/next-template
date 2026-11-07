import { searchTasks } from "@/features/task/server";
import { routeHandler } from "@/lib/route-handler";

export const GET = routeHandler(async (request) => ({
  items: await searchTasks(new URL(request.url).searchParams.get("term") ?? ""),
}));
