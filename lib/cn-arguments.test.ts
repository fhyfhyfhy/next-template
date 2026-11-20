import { expect, test } from "vitest";

import { cn } from "./cn";

test("函数式 className 只在第二个也是最后一个参数时按 state 求值，其他位置是类型错误", () => {
  const className = (state: { open: boolean }) =>
    state.open ? "p-4" : undefined;

  expect(cn("p-2", className)({ open: true })).toBe("p-4");

  // 下面三处都是类型错误；运行时函数被丢掉，只剩其他参数合并的结果。
  // @ts-expect-error 函数式 className 后面不能再有参数
  expect(cn("p-2", "m-2", className)).toBe("p-2 m-2");
  // @ts-expect-error 函数式 className 不能放在第一个参数
  expect(cn(className, "p-2")).toBe("p-2");
  // @ts-expect-error 函数式 className 不能单独传
  expect(cn(className)).toBe("");
});
