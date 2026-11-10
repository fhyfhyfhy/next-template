import { globSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

import { ErrorCode } from "./domain-error";

// 界面按错误码选文案，两个 feature 用了同一个码就会显示成对方的提示；各 feature 的码分在各自的文件里，
// 只有放在一起才看得出重复（.claude/rules/server-data.md 的 Errors）。所以这里按路径读各 feature 的错误码文件。

const projectRoot = join(import.meta.dirname, "..", "..");

const sources: { file: string; codes: Record<string, unknown> }[] = [
  { file: "lib/request/domain-error.ts", codes: ErrorCode },
];
for (const file of globSync("features/*/constants/error-codes.ts", {
  cwd: projectRoot,
}).sort()) {
  sources.push({
    file: file.split("\\").join("/"),
    codes: await import(/* @vite-ignore */ join(projectRoot, file)),
  });
}

const entries = sources.flatMap(({ file, codes }) =>
  Object.entries(codes).flatMap(([name, code]) =>
    typeof code === "number" ? [{ file, name, code }] : [],
  ),
);

test("错误码是五位整数，前三位是 4xx 或 5xx 的 HTTP status", () => {
  const invalid = entries.filter(
    ({ code }) => !Number.isInteger(code) || code < 40000 || code > 59999,
  );
  expect(invalid).toStrictEqual([]);
});

test("错误码在 lib/request/domain-error.ts 和各 feature 之间不重复", () => {
  const duplicates = entries
    .filter(
      (entry) => entries.filter(({ code }) => code === entry.code).length > 1,
    )
    .map(({ file, name, code }) => `${code} ${file} ${name}`);
  expect(duplicates).toStrictEqual([]);
});
