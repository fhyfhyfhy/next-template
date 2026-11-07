import "server-only";

import { getDb } from "@/lib/db";

import type { TaskTables } from "./tables";

export function getTaskDb() {
  return getDb<TaskTables>();
}
