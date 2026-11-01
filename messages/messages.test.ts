import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isLiteralElement,
  isPluralElement,
  isPoundElement,
  isSelectElement,
  isTagElement,
  type MessageFormatElement,
  parse,
} from "@formatjs/icu-messageformat-parser";
import { describe, expect, test } from "vitest";
import { z } from "zod";

import { NAMESPACES } from "@/lib/i18n/messages";
import { routing, SOURCE_LOCALE } from "@/lib/i18n/routing";

const MESSAGES_DIR = import.meta.dirname;
const TARGET_LOCALES = routing.locales.filter(
  (locale) => locale !== SOURCE_LOCALE,
);

function namespaceFiles(locale: string) {
  return readdirSync(join(MESSAGES_DIR, locale))
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
    .sort();
}

/** 一个 namespace 的全部文案，key 是 next-intl 里用的点分路径（`taskList.emptyTitle`）。 */
function readMessages(locale: string, namespace: string) {
  const json: unknown = JSON.parse(
    readFileSync(join(MESSAGES_DIR, locale, `${namespace}.json`), "utf8"),
  );
  const messages = new Map<string, unknown>();
  const visit = (value: unknown, path: string) => {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value)) {
        visit(child, path ? `${path}.${key}` : key);
      }
    } else {
      messages.set(path, value);
    }
  };
  visit(json, "");
  return messages;
}

/** 文案不是非空字符串，或者不是合法的 ICU message 时返回原因。 */
function invalidReason(message: unknown) {
  if (typeof message !== "string") return "不是字符串";
  if (message.trim() === "") return "是空字符串";
  try {
    parse(message);
  } catch (error) {
    return `ICU 语法错误：${String(error)}`;
  }
}

describe.each(routing.locales)("%s", (locale) => {
  test("namespace 文件和 NAMESPACES 一一对应", () => {
    expect(namespaceFiles(locale)).toStrictEqual([...NAMESPACES].sort());
  });

  test.each(NAMESPACES)(
    "%s 的文案都是非空、合法的 ICU message",
    (namespace) => {
      const invalid = [...readMessages(locale, namespace)].flatMap(
        ([key, message]) => {
          const reason = invalidReason(message);
          return reason ? [`${key}: ${reason}`] : [];
        },
      );
      expect(invalid).toStrictEqual([]);
    },
  );
});

/** message 用到的插值参数和 rich text 标签名，包括 plural、select 分支里的。 */
function argumentNames(message: unknown) {
  const names = new Set<string>();
  const visit = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      if (isLiteralElement(element) || isPoundElement(element)) continue;
      names.add(element.value);
      if (isPluralElement(element) || isSelectElement(element)) {
        for (const option of Object.values(element.options)) {
          visit(option.value);
        }
      }
      if (isTagElement(element)) visit(element.children);
    }
  };
  if (typeof message === "string") visit(parse(message));
  return [...names].sort();
}

const termsSchema = z.strictObject({
  keep: z.array(z.string().min(1)),
  translations: z.record(
    z.string().min(1),
    // 缺了哪个 locale 由下面的用例逐条报出，这里不要求齐全。
    z.partialRecord(z.enum(TARGET_LOCALES), z.string().min(1)),
  ),
});
const terms = termsSchema.parse(
  JSON.parse(readFileSync(join(MESSAGES_DIR, "terms.json"), "utf8")),
);

/** 源语言文案里出现的术语，对应 locale 的译文必须包含的写法；大小写不敏感，句首大写也算。 */
function requiredTerms(
  source: string,
  locale: (typeof TARGET_LOCALES)[number],
) {
  const lower = source.toLowerCase();
  return [
    ...terms.keep.filter((term) => lower.includes(term.toLowerCase())),
    ...Object.entries(terms.translations).flatMap(([term, translations]) => {
      const translation = translations[locale];
      return source.includes(term) && translation ? [translation] : [];
    }),
  ];
}

test.each(Object.keys(terms.translations))(
  "术语「%s」给每个非源语言都规定了译法",
  (term) => {
    expect(Object.keys(terms.translations[term]).sort()).toStrictEqual(
      [...TARGET_LOCALES].sort(),
    );
  },
);

describe.each(TARGET_LOCALES)("%s 对照 Source locale", (locale) => {
  test.each(NAMESPACES)("%s 的译文遵守 terms.json", (namespace) => {
    const target = readMessages(locale, namespace);
    const violations = [...readMessages(SOURCE_LOCALE, namespace)].flatMap(
      ([key, source]) => {
        if (typeof source !== "string") return [];
        const translation = String(target.get(key) ?? "").toLowerCase();
        return requiredTerms(source, locale)
          .filter((term) => !translation.includes(term.toLowerCase()))
          .map((term) => `${key}: 缺少「${term}」`);
      },
    );
    expect(violations).toStrictEqual([]);
  });

  test.each(NAMESPACES)("%s 的 key 和 Source locale 一致", (namespace) => {
    const source = readMessages(SOURCE_LOCALE, namespace);
    const target = readMessages(locale, namespace);
    expect([...target.keys()].sort()).toStrictEqual([...source.keys()].sort());
  });

  test.each(NAMESPACES)(
    "%s 的插值参数和标签和 Source locale 一致",
    (namespace) => {
      const source = readMessages(SOURCE_LOCALE, namespace);
      const target = readMessages(locale, namespace);
      const mismatched = [...source].flatMap(([key, message]) => {
        const expected = argumentNames(message).join(", ");
        const actual = argumentNames(target.get(key)).join(", ");
        return expected === actual
          ? []
          : [`${key}: {${actual}}，应为 {${expected}}`];
      });
      expect(mismatched).toStrictEqual([]);
    },
  );
});
