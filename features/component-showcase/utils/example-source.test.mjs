import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import ts from "typescript";

import { exampleFiles } from "../constants/example-files.generated.ts";
import { formatExampleSource } from "./example-source.ts";

const start = "/* @example-config */";
const end = "/* @end-example-config */";

test("参数中的引号、换行和代码字符只作为字符串保存", () => {
  const prefix = `const config = ${start}`;
  const suffix = `${end};\nexport function Example() { return config; }`;
  const config = {
    label: '"\n</script>`${alert(1)}\\',
    value: "中英文😀\u2028\u2029",
    checked: false,
    size: "sm",
    values: ["a", "b"],
  };
  const result = formatExampleSource(prefix + " {} " + suffix, config);
  assert.equal(result.slice(0, prefix.length), prefix);
  assert.equal(result.slice(-suffix.length), suffix);
  assert.deepEqual(
    JSON.parse(result.slice(prefix.length, -suffix.length)),
    config,
  );
});

test("标记缺失、重复或倒置时拒绝生成误导代码", () => {
  for (const source of [
    "",
    start,
    end + start,
    start + start + end,
    start + end + end,
  ]) {
    assert.throws(() => formatExampleSource(source, {}), /marker pair/);
  }
});

test("可调预览格式化后仍可替换参数，所有发现的示例都可独立复制", async () => {
  for (const [component, examples] of Object.entries(exampleFiles)) {
    const directory = new URL(
      `../components/${component}-examples/`,
      import.meta.url,
    );
    const filepath = fileURLToPath(new URL("playground.tsx", directory));
    const source = await readFile(filepath, "utf8");
    const config = JSON.parse(source.split(start)[1].split(end)[0]);
    const formatted = await prettier.format(source, {
      ...(await prettier.resolveConfig(filepath)),
      filepath,
    });
    assert.deepEqual(
      JSON.parse(formatted.split(start)[1].split(end)[0]),
      config,
      component,
    );
    const result = formatExampleSource(formatted, config);
    const output = ts.transpileModule(result, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ESNext,
      },
      fileName: "example.tsx",
      reportDiagnostics: true,
    });
    assert.deepEqual(output.diagnostics, [], component);
    for (const filename of [
      "playground.tsx",
      ...examples.map((example) => example.filename),
    ]) {
      const text = await readFile(new URL(filename, directory), "utf8");
      assert.doesNotMatch(
        text,
        /from ["']\./,
        `${component}/${filename} should copy independently`,
      );
      const compiled = ts.transpileModule(text, {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
        fileName: filename,
        reportDiagnostics: true,
      });
      assert.deepEqual(compiled.diagnostics, [], `${component}/${filename}`);
    }
  }
});
