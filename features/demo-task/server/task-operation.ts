import "server-only";

import {
  type DemoOperation,
  demoOperation,
} from "@/features/demo-faults/server";

import { ensureDemoSeeded } from "./seed";

/**
 * 给 demo-task 的数据层操作套上 demo-faults 的 `demoOperation`（默认延迟、注入的故障、调用记录），执行前先等种子
 * 数据写入：第一次启动后（包括 build 时的预渲染）读到的总是种子数据。真实项目的数据层没有这一层。
 */
export function taskOperation<TArgs extends unknown[], TResult>(
  operation: DemoOperation,
  access: "read" | "write",
  run: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  const wrapped = demoOperation(operation, access, run);
  return async (...args) => {
    await ensureDemoSeeded();
    return wrapped(...args);
  };
}
