import type { Generated } from "kysely";

// demo-faults 拥有的表，结构由同目录的 migrations.mts 创建。

/** 注入的故障，按 `id` 的顺序匹配。字段含义见 types/demo-fault.ts 的 `demoFaultSchema`。 */
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
  /** 每次重置加一，写操作据此认出延迟期间赶上重置的请求。 */
  reset_epoch: number;
}

export interface DemoCallsTable {
  /** bigint，pg 返回字符串。 */
  id: Generated<string>;
  operation: string;
  /** `server`：服务端直接调用；`http`：浏览器经 Route Handler 调用。 */
  source: string;
  called_at: Generated<Date>;
}

export interface FaultTables {
  demo_faults: DemoFaultsTable;
  demo_settings: DemoSettingsTable;
  demo_calls: DemoCallsTable;
}
