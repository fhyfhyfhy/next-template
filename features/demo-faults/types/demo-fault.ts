import { z } from "zod";

/**
 * 数据层对外的每个业务操作的名字。故障按它匹配，调用记录也按它记；服务端直接调用、浏览器经 Route Handler
 * 调用和 Server Action 调用的是同一个操作，故障对三者都生效。加一个数据层操作时在这里加一项。
 */
export const demoOperationSchema = z.enum([
  "task.list",
  "task.get",
  "task.search",
  "feed.list",
  "comment.list",
  "task.model",
  "task.create",
  "task.rename",
  "task.setFavorite",
  "task.retry",
  "task.delete",
  "task.setCover",
  "comment.create",
  "comment.delete",
]);
export type DemoOperation = z.infer<typeof demoOperationSchema>;

/** 默认延迟和故障延迟的上限。 */
export const MAX_LATENCY_MS = 30_000;

/**
 * 故障的效果：
 * - `latency`：只在默认延迟之上再加 `latencyMs`；
 * - `unexpected`：操作抛出意外错误。服务端渲染时进入 error.tsx，Route Handler 返回 500，Server Action 显示通用提示；
 * - `businessError`：操作按业务规则拒绝，HTTP status 为 `status`（默认 409），业务码为 `code`；
 * - 以下三种只在浏览器经 Route Handler 请求时生效，演示 `fetchApi` 怎样处理不合格的响应：
 *   `httpStatus` 返回 `status` 状态码；`errorOnSuccess` 返回 200 但响应体只有 error 对象；`malformed` 返回不符合 schema 的 200。
 */
export const faultKindSchema = z.enum([
  "latency",
  "unexpected",
  "businessError",
  "httpStatus",
  "errorOnSuccess",
  "malformed",
]);
export type FaultKind = z.infer<typeof faultKindSchema>;

export const HTTP_ONLY_FAULT_KINDS = [
  "httpStatus",
  "errorOnSuccess",
  "malformed",
] as const satisfies readonly FaultKind[];

export const demoFaultSchema = z
  .object({
    operation: demoOperationSchema,
    kind: faultKindSchema,
    /** 在默认延迟之上额外的延迟，任何效果都可以带。 */
    latencyMs: z.number().int().min(0).max(MAX_LATENCY_MS),
    code: z.number().int().nullable(),
    status: z.number().int().min(400).max(599).nullable(),
    /** 剩余生效次数，用完即删除；null 表示一直生效。 */
    times: z.number().int().positive().nullable(),
  })
  .refine((fault) => fault.kind !== "businessError" || fault.code !== null, {
    message: "businessError needs a code",
    path: ["code"],
  })
  .refine((fault) => fault.kind !== "httpStatus" || fault.status !== null, {
    message: "httpStatus needs a status",
    path: ["status"],
  });
export type DemoFault = z.infer<typeof demoFaultSchema>;

export const demoFaultListSchema = z.object({
  faults: z.array(demoFaultSchema),
});

/** 业务操作当前的默认延迟（毫秒）。 */
export const demoLatencySchema = z.object({ latencyMs: z.number() });

/** 调用记录的一条。`source` 为 `server` 时是服务端直接调用（渲染、Server Action），`http` 时是浏览器经 Route Handler 调用。 */
export const demoCallSchema = z.object({
  operation: z.string(),
  source: z.enum(["server", "http"]),
  calledAt: z.number(),
});
export type DemoCall = z.infer<typeof demoCallSchema>;
