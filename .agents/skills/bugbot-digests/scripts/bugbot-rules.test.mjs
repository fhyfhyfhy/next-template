import { existsSync, readdirSync } from "node:fs";
import { join, posix } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";

import {
  currentBugbotFiles,
  digestPath,
  DIGESTS_DIR,
  expectedBugbotFiles,
  findProjectRoot,
  loads,
  MAX_FILE_CHARS,
  MAX_LOAD_CHARS,
  planTotals,
  readText,
  ruleDirectories,
  ruleFiles,
  rulePaths,
  staleDigests,
} from "./bugbot-rules.mjs";

const projectRoot = findProjectRoot(import.meta.dirname);

describe("the directories a rule goes into", () => {
  const files = [
    "proxy.ts",
    "app/page.tsx",
    "app/api/health/route.ts",
    "features/orders/api/create-order-action.ts",
    "features/invoices/api/send-invoice-action.ts",
    "features/orders/server/orders.ts",
    ".claude/rules/data-flow.md",
  ];

  test("a rule without paths goes to the project root", () => {
    expect(ruleDirectories("r.md", [], files)).toStrictEqual([""]);
  });

  test("a glob is cut at its first **, so one copy covers the subtree", () => {
    expect(ruleDirectories("r.md", ["app/api/**"], files)).toStrictEqual([
      "app/api",
    ]);
  });

  test("a glob naming files goes into each matching file's directory", () => {
    expect(
      ruleDirectories("r.md", ["features/*/api/*-action.ts"], files),
    ).toStrictEqual(["features/orders/api", "features/invoices/api"]);
  });

  test("a file at the root puts the rule at the root, and no copy below it", () => {
    expect(
      ruleDirectories("r.md", ["proxy.ts", "app/api/**"], files),
    ).toStrictEqual([""]);
  });

  test("features/ gives way to its features, each of which is a feature directory", () => {
    expect(ruleDirectories("r.md", ["features/**"], files)).toStrictEqual([
      "features/orders",
      "features/invoices",
    ]);
  });

  test("no copy goes into a dot-directory, where Claude Code would load it as a rule", () => {
    expect(ruleDirectories("r.md", [".claude/rules/**"], files)).toStrictEqual(
      [""],
    );
  });

  test("paths that match no file throw, since Bugbot would never load the rule", () => {
    expect(() => ruleDirectories("r.md", ["nowhere/**"], files)).toThrow(
      "match no file",
    );
  });
});

describe("a plan's totals by budgets", () => {
  const entries = [
    { directories: [""], budget: 3000 },
    { directories: ["app/api"], budget: 2000 },
    { directories: ["features/orders", "app"], budget: 1000 },
  ];
  const files = [
    "proxy.ts",
    "app/page.tsx",
    "app/api/health/route.ts",
    "features/orders/index.ts",
  ];

  test("the root carries the budgets of the rules placed there", () => {
    expect(planTotals(entries, files).root).toBe(3000);
  });

  test("the heaviest change adds every directory above it to the root", () => {
    expect(planTotals(entries, files).heaviest).toStrictEqual({
      file: "app/api/health/route.ts",
      load: 6000,
    });
  });
});

describe("reading a rule's paths", () => {
  test("reads the block list, with or without quotes", () => {
    const text = '---\npaths:\n  - "app/**"\n  - lib/x.ts\n---\n\n# R\n';
    expect(rulePaths("r.md", text)).toStrictEqual(["app/**", "lib/x.ts"]);
  });

  test("throws on any other form rather than read it as no paths", () => {
    expect(() =>
      rulePaths("r.md", '---\npaths: ["app/**"]\n---\n\n# R\n'),
    ).toThrow("block list");
  });
});

// Only a project that keeps digests, which next-template itself does not.
describe.skipIf(!existsSync(join(projectRoot, DIGESTS_DIR)))(
  "the project's BUGBOT.md files",
  () => {
    // Read in beforeAll, so a missing or malformed digest fails these tests and not the file.
    let expected;
    beforeAll(() => {
      expected = expectedBugbotFiles(projectRoot);
    });

    test("match the rules and digests: run the generator after changing either", () => {
      expect(currentBugbotFiles(projectRoot)).toStrictEqual(expected);
    });

    test("each digest condenses its rule as it is now", () => {
      expect(staleDigests(projectRoot)).toStrictEqual([]);
    });

    test("each digest has its rule", () => {
      const digests = [];
      const walk = (directory) => {
        for (const entry of readdirSync(join(projectRoot, directory), {
          withFileTypes: true,
        })) {
          const path = posix.join(directory, entry.name);
          if (entry.isDirectory()) walk(path);
          else digests.push(path);
        }
      };
      walk(DIGESTS_DIR);
      expect(digests.sort()).toStrictEqual(
        ruleFiles(projectRoot).map(digestPath).sort(),
      );
    });

    test("hold no links: Bugbot reads on through every linked file, past its limits", () => {
      for (const [file, content] of Object.entries(expected))
        expect(content, file).not.toMatch(/\]\(/);
      for (const file of ruleFiles(projectRoot).map(digestPath))
        expect(readText(projectRoot, file), file).not.toMatch(/\]\(/);
    });

    test(`are each at most ${MAX_FILE_CHARS} characters`, () => {
      for (const [file, content] of Object.entries(expected))
        expect(content.length, file).toBeLessThanOrEqual(MAX_FILE_CHARS);
    });

    test(`give a change to any one file at most ${MAX_LOAD_CHARS} characters of rules`, () => {
      const [heaviest] = loads(projectRoot, expected);
      expect(heaviest.load, heaviest.file).toBeLessThanOrEqual(MAX_LOAD_CHARS);
    });
  },
);
