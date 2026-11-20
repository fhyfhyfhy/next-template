import { readFile } from "node:fs/promises";
import ts from "typescript";
import { expect, test } from "vitest";

import { exampleFiles } from "../constants/example-files.generated.ts";
import { formatExampleSource } from "./example-source.ts";

const start = "/* @example-config */";
const end = "/* @end-example-config */";

/** 把 config 写进一段带标记的源码，确认标记外的部分不变，返回标记之间的 JSON。 */
function format(config) {
  const prefix = `const config = ${start}`;
  const suffix = `${end};\nexport function Example() { return config; }`;
  const result = formatExampleSource(prefix + " {} " + suffix, config);
  expect(result.slice(0, prefix.length)).toBe(prefix);
  expect(result.slice(-suffix.length)).toBe(suffix);
  return result.slice(prefix.length, -suffix.length);
}

test("参数中的引号、换行和代码字符只作为字符串保存", () => {
  const config = {
    label: '"\n</script>`${alert(1)}\\',
    value: "中英文😀\u2028\u2029",
    checked: false,
    size: "sm",
    values: ["a", "b"],
  };
  expect(JSON.parse(format(config))).toStrictEqual(config);
});

test("U+2028 和 U+2029 显示为转义，而不是看不见的字符本身", () => {
  const json = format({ value: "a\u2028b\u2029c" });
  expect(json).toContain(String.raw`"a\u2028b\u2029c"`);
  expect(json).not.toMatch(/[\u2028\u2029]/);
});

test("标记缺失、重复或倒置时拒绝生成误导代码", () => {
  for (const source of [
    "",
    start,
    end + start,
    start + start + end,
    start + end + end,
  ]) {
    expect(() => formatExampleSource(source, {})).toThrow(/marker pair/);
  }
});

test.each(Object.keys(exampleFiles))(
  "%s 的 playground 填入页面写回的 config 后仍能编译",
  async (component) => {
    const source = await readFile(
      new URL(
        `../components/${component}-examples/playground.tsx`,
        import.meta.url,
      ),
      "utf8",
    );
    const config = JSON.parse(source.split(start)[1].split(end)[0]);
    const output = ts.transpileModule(formatExampleSource(source, config), {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ESNext,
      },
      fileName: "playground.tsx",
      reportDiagnostics: true,
    });
    expect(output.diagnostics).toStrictEqual([]);
  },
);
