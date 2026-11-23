import { expect, test } from "vitest";

import { compareExamples } from "./example-order";

function sorted(examples: { id: string; order?: number }[]) {
  return [...examples].sort(compareExamples).map(({ id }) => id);
}

test("order 小的排在前面，和 ID 无关", () => {
  expect(
    sorted([
      { id: "icon-only", order: 40 },
      { id: "basic", order: 50 },
      { id: "icons", order: 30 },
    ]),
  ).toStrictEqual(["icons", "icon-only", "basic"]);
});

test("未设 order 视为 0，排在正数之前、负数之后", () => {
  expect(
    sorted([
      { id: "later", order: 1 },
      { id: "unset" },
      { id: "first", order: -1 },
    ]),
  ).toStrictEqual(["first", "unset", "later"]);
});

test("order 相同时按 ID 排，所以 icon 在 icon-only 前面，和文件名的顺序相反", () => {
  expect(
    sorted([{ id: "icon-only" }, { id: "icon" }, { id: "basic" }]),
  ).toStrictEqual(["basic", "icon", "icon-only"]);
});
