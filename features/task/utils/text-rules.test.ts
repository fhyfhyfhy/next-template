import { describe, expect, test } from "vitest";

import { DomainError } from "@/lib/request/domain-error";

import { containsPattern, requireText } from "./text-rules";

describe("requireText", () => {
  test("返回去掉首尾空白的文本", () => {
    expect(requireText("  狐狸  ", "name", 40)).toBe("狐狸");
  });

  test("为空、只有空白、超长或不是字符串时按参数错误拒绝，带字段名、上限和业务码", () => {
    for (const value of ["", "   ", "长".repeat(41), 42, null]) {
      expect(() => requireText(value, "name", 40, 40001)).toThrow(
        expect.objectContaining({
          status: 400,
          code: 40001,
          param: "name",
          params: { max: 40 },
        }),
      );
    }
    expect(() => requireText("", "name", 40)).toThrow(DomainError);
  });
});

test("搜索关键词里的 %、_ 和反斜杠按普通字符匹配", () => {
  expect(containsPattern("狐狸")).toBe("%狐狸%");
  expect(containsPattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
});
