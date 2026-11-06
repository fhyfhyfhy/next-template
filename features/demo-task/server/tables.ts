import type { Generated } from "kysely";

import type { TaskStatus } from "../types/task-filters";

// demo-task 拥有的表，结构由同目录的 migrations.mts 创建。上传和附件属于 demo-upload，不在这里：
// 需要封面或模型时调用 demo-upload 的服务端入口。

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

/** 只有一行。 */
export interface TaskSettingsTable {
  id: Generated<boolean>;
  /** 暂停时 Demo generator 不自动推进任务。 */
  clock_paused: boolean;
  /** 写入过种子数据之后为 true；之后即使任务全被删除，重启也不再写入。 */
  seeded: boolean;
}

export interface TaskTables {
  tasks: TasksTable;
  task_comments: TaskCommentsTable;
  task_logs: TaskLogsTable;
  task_settings: TaskSettingsTable;
}
