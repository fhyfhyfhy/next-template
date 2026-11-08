import "server-only";
import type { Generated } from "kysely";

import type { TaskStatus } from "../types/task-filters";

// task 拥有的表，结构由同目录的 migrations.mts 创建。Upload 和它的关联（`uploads`、`upload_attachments`）属于 upload，不在这里：
// 需要封面或模型时调用 upload 的服务端入口。

export interface TasksTable {
  id: string;
  name: string;
  prompt: string;
  status: TaskStatus;
  progress: number;
  favorite: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TaskCommentsTable {
  id: string;
  task_id: string;
  content: string;
  created_at: Date;
}

export interface TaskLogsTable {
  /** 写入顺序，SSE 按它推送增量、去重。bigint，pg 返回字符串。 */
  seq: Generated<string>;
  task_id: string;
  line: string;
  created_at: Generated<Date>;
}

export interface TaskTables {
  tasks: TasksTable;
  task_comments: TaskCommentsTable;
  task_logs: TaskLogsTable;
}
