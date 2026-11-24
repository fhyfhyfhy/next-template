import { globSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { z } from "zod";

import { DomainError, ErrorCode, parseInput } from "./domain-error";

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

/** `parseInput` 拒绝 `value` 时抛出的错误。 */
function refusal(schema: z.ZodType, value: unknown): DomainError {
  try {
    parseInput(schema, value);
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error("parseInput accepted the value");
}

test("parseInput 返回 schema 解析后的值，包括它的转换", () => {
  const schema = z.object({
    name: z.string().trim(),
    count: z.coerce.number(),
  });
  expect(parseInput(schema, { name: " a ", count: "2" })).toStrictEqual({
    name: "a",
    count: 2,
  });
});

test("parseInput 解析不了时按参数错误拒绝，param 写第一个出错的字段", () => {
  const schema = z.object({
    name: z.string(),
    tags: z.array(z.string()),
  });
  const error = refusal(schema, { name: 1, tags: ["a", 2] });
  expect([error.status, error.code, error.param]).toStrictEqual([
    400,
    ErrorCode.BAD_REQUEST,
    "name",
  ]);
  expect(refusal(schema, { name: "a", tags: ["a", 2] }).param).toBe("tags.1");
});

test("parseInput 拒绝的不是哪个字段时不带 param", () => {
  expect(refusal(z.string(), 1).param).toBeUndefined();
});
