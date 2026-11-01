import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

import { DomainError, ErrorCode } from "@/lib/domain-error";

import type { DemoOperation } from "../types/demo-fault";
import { HTTP_ONLY_FAULT_KINDS } from "../types/demo-fault";
import { getTaskDb } from "./connection";
import { ensureDemoSeeded } from "./seed";
import type { DemoFaultsTable } from "./tables";

// 只在 Demo 里使用：给数据层的每个业务操作加上故障实验室的控制（默认延迟、注入的故障、调用记录、重置纪元）。
// 真实项目的数据层没有这一层，照着 Demo 写数据函数时不要带上它。

export type CallSource = "server" | "http";

const requestSource = new AsyncLocalStorage<CallSource>();

/** 在浏览器经 Route Handler 发来的请求里执行 `run`：其中的数据层调用记为 `http`，只在 HTTP 上生效的故障也会生效。 */
export function runAsHttpRequest<TResult>(run: () => Promise<TResult>) {
  return requestSource.run("http", run);
}

/** 只在 HTTP 上生效的故障，由 Route Handler 的适配层（http.ts）转成对应的响应。 */
export class HttpFaultError extends Error {
  readonly fault: Pick<DemoFaultsTable, "kind" | "code" | "status">;

  constructor(fault: Pick<DemoFaultsTable, "kind" | "code" | "status">) {
    super(`Injected ${fault.kind} fault`);
    this.name = "HttpFaultError";
    this.fault = fault;
  }
}

/**
 * 包装一个数据层操作。每次调用依次：记一条调用记录；取出匹配的故障（扣减次数）；等默认延迟加故障延迟；
 * 写操作在等待期间赶上重置时拒绝执行（上一个 e2e 用例没完成的写入不能改动下一个用例重置后的数据）；
 * 按故障抛错，没有故障时执行操作。读操作在外层再包一层 React `cache()`，同一次渲染里去重的调用只记一次、只扣一次故障。
 */
export function demoOperation<TArgs extends unknown[], TResult>(
  operation: DemoOperation,
  access: "read" | "write",
  run: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args) => {
    await ensureDemoSeeded();
    const source = requestSource.getStore() ?? "server";
    const db = getTaskDb();
    await db.insertInto("demo_calls").values({ operation, source }).execute();
    const { latencyMs, resetEpoch, fault } = await takeFault(operation, source);
    const delay = latencyMs + (fault?.latency_ms ?? 0);
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (access === "write" && delay > 0) {
      const current = await db
        .selectFrom("demo_settings")
        .select("reset_epoch")
        .executeTakeFirstOrThrow();
      if (current.reset_epoch !== resetEpoch) {
        throw new DomainError(
          503,
          ErrorCode.SERVICE_UNAVAILABLE,
          "The Demo backend was reset before this write was handled",
        );
      }
    }
    if (fault) throwFault(operation, fault);
    return run(...args);
  };
}

/** 读出默认延迟和重置纪元，并取出这次调用要应用的第一条故障：用完次数的删除，其余扣减一次。 */
async function takeFault(operation: DemoOperation, source: CallSource) {
  return getTaskDb()
    .transaction()
    .execute(async (trx) => {
      const settings = await trx
        .selectFrom("demo_settings")
        .select(["latency_ms", "reset_epoch"])
        .executeTakeFirstOrThrow();
      let query = trx
        .selectFrom("demo_faults")
        .selectAll()
        .where("operation", "=", operation);
      if (source !== "http") {
        query = query.where("kind", "not in", [...HTTP_ONLY_FAULT_KINDS]);
      }
      const fault = await query
        .orderBy("id")
        .limit(1)
        .forUpdate()
        .executeTakeFirst();
      if (fault && fault.times !== null) {
        if (fault.times <= 1) {
          await trx
            .deleteFrom("demo_faults")
            .where("id", "=", fault.id)
            .execute();
        } else {
          await trx
            .updateTable("demo_faults")
            .set({ times: fault.times - 1 })
            .where("id", "=", fault.id)
            .execute();
        }
      }
      return {
        latencyMs: settings.latency_ms,
        resetEpoch: settings.reset_epoch,
        fault,
      };
    });
}

function throwFault(
  operation: DemoOperation,
  fault: Pick<DemoFaultsTable, "kind" | "code" | "status">,
) {
  switch (fault.kind) {
    case "unexpected":
      throw new Error(`Injected unexpected error in ${operation}`);
    case "businessError":
      throw new DomainError(
        fault.status ?? 409,
        fault.code ?? ErrorCode.SERVER_ERROR,
        `Injected business error in ${operation}`,
      );
    case "httpStatus":
    case "errorOnSuccess":
    case "malformed":
      throw new HttpFaultError(fault);
    default:
      // latency：只加延迟。
      return;
  }
}
