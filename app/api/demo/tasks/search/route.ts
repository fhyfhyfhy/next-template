import { demoRoute, searchTasks } from "@/features/demo-task/server";

export const GET = demoRoute(async (request) => ({
  items: await searchTasks(new URL(request.url).searchParams.get("term") ?? ""),
}));
