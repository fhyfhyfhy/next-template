import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import ts from "typescript";
import { expect, test } from "vitest";

import { exampleFiles } from "../constants/example-files.generated.ts";
import { formatExampleSource } from "./example-source.ts";

const start = "/* @example-config */";
const end = "/* @end-example-config */";

test("quotes, newlines and code characters in the config stay plain strings", () => {
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
  expect(result.slice(0, prefix.length)).toBe(prefix);
  expect(result.slice(-suffix.length)).toBe(suffix);
  expect(JSON.parse(result.slice(prefix.length, -suffix.length))).toStrictEqual(
    config,
  );
});

test("missing, repeated or reversed markers refuse to produce misleading code", () => {
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

test("a formatted playground still takes a config, and every discovered example copies on its own", async () => {
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
    expect(
      JSON.parse(formatted.split(start)[1].split(end)[0]),
      component,
    ).toStrictEqual(config);
    const result = formatExampleSource(formatted, config);
    const output = ts.transpileModule(result, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ESNext,
      },
      fileName: "example.tsx",
      reportDiagnostics: true,
    });
    expect(output.diagnostics, component).toStrictEqual([]);
    for (const filename of [
      "playground.tsx",
      ...examples.map((example) => example.filename),
    ]) {
      const text = await readFile(new URL(filename, directory), "utf8");
      expect(
        text,
        `${component}/${filename} should copy independently`,
      ).not.toMatch(/from ["']\./);
      const compiled = ts.transpileModule(text, {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
        fileName: filename,
        reportDiagnostics: true,
      });
      expect(compiled.diagnostics, `${component}/${filename}`).toStrictEqual(
        [],
      );
    }
  }
});
