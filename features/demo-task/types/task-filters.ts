import { z } from "zod";

// The status and sort schemas live in types: both the request schemas (api) and
// the URL parsing (utils) use them, and utils can't import api.
export const taskStatusSchema = z.enum([
  "pending",
  "running",
  "done",
  "failed",
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskSortSchema = z.enum([
  "created_desc",
  "created_asc",
  "name_asc",
]);
export type TaskSort = z.infer<typeof taskSortSchema>;

/**
 * The task list endpoint's filter and pagination conditions, shared by the URL
 * parsing (utils) and the request functions (api).
 */
export interface TaskFilters {
  status?: TaskStatus[];
  favorite?: boolean;
  prompt?: string;
  excludeId?: string;
  sort?: TaskSort;
  page?: number;
  pageSize?: number;
}
