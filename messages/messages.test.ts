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

/** Every message of a namespace, keyed by the dotted path next-intl uses (`taskList.emptyTitle`). */
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

/** Why a message is not a non-empty string or not a valid ICU message, if it is not. */
function invalidReason(message: unknown) {
  if (typeof message !== "string") return "not a string";
  if (message.trim() === "") return "an empty string";
  try {
    parse(message);
  } catch (error) {
    return `ICU syntax error: ${String(error)}`;
  }
}

describe.each(routing.locales)("%s", (locale) => {
  test("the namespace files match NAMESPACES one to one", () => {
    expect(namespaceFiles(locale)).toStrictEqual([...NAMESPACES].sort());
  });

  test.each(NAMESPACES)(
    "every message of %s is a non-empty, valid ICU message",
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

/** The interpolated arguments and rich text tag names a message uses, those in plural and select branches included. */
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
    // A missing locale is reported per term by the test below, so this does not require every one.
    z.partialRecord(z.enum(TARGET_LOCALES), z.string().min(1)),
  ),
});
const terms = termsSchema.parse(
  JSON.parse(readFileSync(join(MESSAGES_DIR, "terms.json"), "utf8")),
);

/** How the terms in a source-locale message must appear in the locale's translation; case-insensitive, so a capitalized first word counts. */
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
  'the term "%s" has a translation for every locale but the source locale',
  (term) => {
    expect(Object.keys(terms.translations[term]).sort()).toStrictEqual(
      [...TARGET_LOCALES].sort(),
    );
  },
);

describe.each(TARGET_LOCALES)("%s against the source locale", (locale) => {
  test.each(NAMESPACES)(
    "the %s translation follows terms.json",
    (namespace) => {
      const target = readMessages(locale, namespace);
      const violations = [...readMessages(SOURCE_LOCALE, namespace)].flatMap(
        ([key, source]) => {
          if (typeof source !== "string") return [];
          const translation = String(target.get(key) ?? "").toLowerCase();
          return requiredTerms(source, locale)
            .filter((term) => !translation.includes(term.toLowerCase()))
            .map((term) => `${key}: missing "${term}"`);
        },
      );
      expect(violations).toStrictEqual([]);
    },
  );

  test.each(NAMESPACES)(
    "the keys of %s match the source locale's",
    (namespace) => {
      const source = readMessages(SOURCE_LOCALE, namespace);
      const target = readMessages(locale, namespace);
      expect([...target.keys()].sort()).toStrictEqual(
        [...source.keys()].sort(),
      );
    },
  );

  test.each(NAMESPACES)(
    "the arguments and tags of %s match the source locale's",
    (namespace) => {
      const source = readMessages(SOURCE_LOCALE, namespace);
      const target = readMessages(locale, namespace);
      const mismatched = [...source].flatMap(([key, message]) => {
        const expected = argumentNames(message).join(", ");
        const actual = argumentNames(target.get(key)).join(", ");
        return expected === actual
          ? []
          : [`${key}: {${actual}}, expected {${expected}}`];
      });
      expect(mismatched).toStrictEqual([]);
    },
  );
});
