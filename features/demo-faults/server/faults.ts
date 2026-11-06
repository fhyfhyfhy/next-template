import "server-only";

import { badRequest } from "@/lib/domain-error";

import { DEFAULT_LATENCY_MS } from "../constants/demo-latency";
import {
  type DemoCall,
  type DemoFault,
  demoFaultSchema,
  MAX_LATENCY_MS,
} from "../types/demo-fault";
import { type Executor, faultDb, getFaultDb } from "./connection";

// 故障实验室和 e2e 用的控制操作，只在 Demo 里存在。它们不经过 demoOperation：没有默认延迟，也不受注入的故障影响。

/**
 * 清除故障和调用记录，默认延迟恢复成 500 ms，重置纪元加一（延迟中的写操作据此放弃执行）。
 * 重置整个 Demo 时，调用方把自己的事务传进来，和其他 feature 的重置一起提交。
 */
export async function resetFaults(executor?: Executor) {
  const db = faultDb(executor);
  await db
    .updateTable("demo_settings")
    .set((eb) => ({
      latency_ms: DEFAULT_LATENCY_MS,
      reset_epoch: eb("reset_epoch", "+", 1),
    }))
    .execute();
  await db.deleteFrom("demo_faults").execute();
  await db.deleteFrom("demo_calls").execute();
}

function toFault(row: {
  operation: string;
  kind: string;
  latency_ms: number;
  code: number | null;
  status: number | null;
  times: number | null;
}): DemoFault {
  return demoFaultSchema.parse({
    operation: row.operation,
    kind: row.kind,
    latencyMs: row.latency_ms,
    code: row.code,
    status: row.status,
    times: row.times,
  });
}

/** 当前的故障，按匹配顺序排列。 */
export async function listFaults(): Promise<DemoFault[]> {
  const rows = await getFaultDb()
    .selectFrom("demo_faults")
    .selectAll()
    .orderBy("id")
    .execute();
  return rows.map(toFault);
}

/** 整体替换故障列表。输入不合法时按参数错误拒绝。 */
export async function replaceFaults(input: unknown): Promise<DemoFault[]> {
  const parsed = demoFaultSchema.array().safeParse(input);
  if (!parsed.success) {
    throw badRequest(`Invalid faults: ${parsed.error.message}`, {
      param: "faults",
    });
  }
  await getFaultDb()
    .transaction()
    .execute(async (trx) => {
      await trx.deleteFrom("demo_faults").execute();
      if (parsed.data.length === 0) return;
      await trx
        .insertInto("demo_faults")
        .values(
          parsed.data.map((fault) => ({
            operation: fault.operation,
            kind: fault.kind,
            latency_ms: fault.latencyMs,
            code: fault.code,
            status: fault.status,
            times: fault.times,
          })),
        )
        .execute();
    });
  return listFaults();
}

export async function getDefaultLatency() {
  const settings = await getFaultDb()
    .selectFrom("demo_settings")
    .select("latency_ms")
    .executeTakeFirstOrThrow();
  return settings.latency_ms;
}

/** 修改业务操作的默认延迟，0 到 30000 的整数；重置时恢复成 500。 */
export async function setDefaultLatency(latencyMs: unknown) {
  if (
    typeof latencyMs !== "number" ||
    !Number.isInteger(latencyMs) ||
    latencyMs < 0 ||
    latencyMs > MAX_LATENCY_MS
  ) {
    throw badRequest(
      `latencyMs must be an integer from 0 to ${MAX_LATENCY_MS}`,
      { param: "latencyMs" },
    );
  }
  await getFaultDb()
    .updateTable("demo_settings")
    .set({ latency_ms: latencyMs })
    .execute();
  return latencyMs;
}

/** 重置以来的调用记录，按发生顺序；传了 `operation` 时只看这个操作。 */
export async function listCalls(operation?: string): Promise<DemoCall[]> {
  let query = getFaultDb().selectFrom("demo_calls").selectAll().orderBy("id");
  if (operation !== undefined) query = query.where("operation", "=", operation);
  const rows = await query.execute();
  return rows.map((row) => ({
    operation: row.operation,
    source: row.source === "http" ? "http" : "server",
    calledAt: row.called_at.getTime(),
  }));
}
