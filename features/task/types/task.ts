import { z } from "zod";

import { cursorPageSchema, pageSchema } from "@/lib/fetch";

import { taskStatusSchema } from "./task-filters";

// 数据层（server/）返回、Route Handler 原样序列化、浏览器的 fetchApi 用来校验的同一份结构。服务端 prefetch
// 的数据经 RSC 序列化进浏览器缓存，refetch 的数据经 JSON 进缓存，两条路径要得到一样的值，所以这里只用 JSON
// 原生的类型：时间戳是 epoch 毫秒，可空字段是 null，不用 transform、z.date()、.optional()。

export const taskSchema = z.object({
  id: z.string(),
  name: z.string(),
  prompt: z.string(),
  status: taskStatusSchema,
  progress: z.number(),
  favorite: z.boolean(),
  /** 封面图的地址；没有封面时为 null，显示占位图。 */
  coverUrl: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Task = z.infer<typeof taskSchema>;

export const taskPageSchema = pageSchema(taskSchema);
export type TaskPage = z.infer<typeof taskPageSchema>;

/** 作品广场：只含 done 的任务，按创建时间倒序，游标分页。 */
export const feedPageSchema = cursorPageSchema(taskSchema);
export type FeedPage = z.infer<typeof feedPageSchema>;

export const taskListSchema = z.object({ items: z.array(taskSchema) });

export const taskCommentSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  content: z.string(),
  createdAt: z.number(),
});
export type TaskComment = z.infer<typeof taskCommentSchema>;

export const taskCommentListSchema = z.object({
  items: z.array(taskCommentSchema),
});
