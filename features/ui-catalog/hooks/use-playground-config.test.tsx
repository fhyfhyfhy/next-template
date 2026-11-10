import { renderToString } from "react-dom/server";
import { expect, expectTypeOf, test } from "vitest";

import { usePlaygroundConfig } from "./use-playground-config";

const source =
  "export const initialConfig = (/* @example-config */ {} /* @end-example-config */);";
const initialConfig: { size: "sm" | "md"; label: string; rows: number } = {
  size: "md",
  label: "Start",
  rows: 3,
};

function Labels() {
  const { field } = usePlaygroundConfig(initialConfig, source);
  const size = field("size");
  const label = field("label", "aria-label");
  return `${size.label}=${size.value} ${label.label}=${label.value}`;
}

// 组件渲染过程中对自己的 state 做的更新，React 会先应用再重新渲染一次；服务端渲染也
// 一样，所以这里看到的是改动一次之后的 config。
function ChangedSize() {
  const { config, field } = usePlaygroundConfig(initialConfig, source);
  const size = field("size");
  if (size.value === "md") size.onChange("sm");
  return `${config.size} ${config.label}`;
}

function NumberFields() {
  const { config, numberField } = usePlaygroundConfig(initialConfig, source);
  const rows = numberField("rows", "row count");
  if (rows.value === "3") rows.onChange("5");
  return `${rows.label}=${rows.value} ${typeof config.rows} ${config.label}`;
}

function ChangedSource() {
  const { field, playground } = usePlaygroundConfig(initialConfig, source);
  const label = field("label");
  if (label.value === "Start") label.onChange("Changed");
  return playground.source;
}

// expectTypeOf 在运行时什么都不做，这些断言由 tsc 检查。
function Types() {
  const { field } = usePlaygroundConfig(initialConfig, source);
  expectTypeOf(field).parameter(0).toEqualTypeOf<"size" | "label" | "rows">();
  expectTypeOf(field("size").value).toEqualTypeOf<"sm" | "md">();
  expectTypeOf(field("size").onChange)
    .parameter(0)
    .toEqualTypeOf<"sm" | "md">();
  const { numberField } = usePlaygroundConfig(initialConfig, source);
  expectTypeOf(numberField).parameter(0).toEqualTypeOf<"rows">();
  return null;
}

test("field 不传 label 时以 key 为标签，value 是这个 key 的值", () => {
  expect(renderToString(<Labels />)).toBe("size=md aria-label=Start");
});

test("field 的 onChange 只改自己的 key，config 的其余部分不变", () => {
  expect(renderToString(<ChangedSize />)).toBe("sm Start");
});

test("numberField 把 key 的数字显示成文字，写回文字对应的数字，其余部分不变", () => {
  expect(renderToString(<NumberFields />)).toBe("row count=5 number Start");
});

test("playground.source 是填入当前 config 的源码", () => {
  const rendered = renderToString(<ChangedSource />).replaceAll("&quot;", '"');
  expect(
    JSON.parse(rendered.split("/* @example-config */")[1].split("/* @end")[0]),
  ).toStrictEqual({ ...initialConfig, label: "Changed" });
});

test("field 只接受 config 的 key，value 和 onChange 是这个 key 的类型；numberField 只接受值为 number 的 key", () => {
  expect(renderToString(<Types />)).toBe("");
});
