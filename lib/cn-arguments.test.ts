import { expect, expectTypeOf, test } from "vitest";

import { cn } from "./cn";

test("函数式 className 只在第二个也是最后一个参数时按 state 求值，其他位置是类型错误", () => {
  const className = (state: { open: boolean }) =>
    state.open ? "p-4" : undefined;

  expect(cn("p-2", className)({ open: true })).toBe("p-4");

  // 约定只到类型错误为止，用错时运行时怎么处理不在约定里，所以下面三处只交给 tsc 检查、不调用
  // （expectTypeOf 在运行时什么都不做）。
  expectTypeOf(() => {
    // @ts-expect-error 函数式 className 后面不能再有参数
    cn("p-2", "m-2", className);
    // @ts-expect-error 函数式 className 不能放在第一个参数
    cn(className, "p-2");
    // @ts-expect-error 函数式 className 不能单独传
    cn(className);
  }).toBeFunction();
});
