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

/** 故障实验室注入的故障，按 `id` 的顺序匹配。字段含义见 types/demo-fault.ts 的 `demoFaultSchema`。 */
export interface DemoFaultsTable {
  /** bigint，pg 返回字符串。 */
  id: Generated<string>;
  operation: string;
  kind: string;
  latency_ms: number;
  code: number | null;
  status: number | null;
  times: number | null;
}

/** 只有一行。 */
export interface DemoSettingsTable {
  id: Generated<boolean>;
  /** 业务操作的默认延迟。 */
  latency_ms: number;
  /** 暂停时 Demo 生成器不自动推进任务。 */
  clock_paused: boolean;
  /** 每次重置加一，写操作据此认出延迟期间赶上重置的请求。 */
  reset_epoch: number;
  /** 写入过种子数据之后为 true；之后即使任务全被删除，重启也不再写入。 */
  seeded: boolean;
}

export interface DemoCallsTable {
  /** bigint，pg 返回字符串。 */
  id: Generated<string>;
  operation: string;
  /** `server`：服务端直接调用；`http`：浏览器经 Route Handler 调用。 */
  source: string;
  called_at: Generated<Date>;
}

export interface TaskTables {
  tasks: TasksTable;
  task_comments: TaskCommentsTable;
  task_logs: TaskLogsTable;
  demo_faults: DemoFaultsTable;
  demo_settings: DemoSettingsTable;
  demo_calls: DemoCallsTable;
}
