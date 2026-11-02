import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, test } from "vitest";

// The docs agents read refer to each other by relative links, and demos.md also lists the code and
// spec paths of each scenario; when a file moves or is renamed, this points out the broken
// references. External links and the installed docs in node_modules are not checked.

const projectRoot = join(import.meta.dirname, "..");
const read = (file) =>
  readFileSync(join(projectRoot, file), "utf8").replace(/\r\n/g, "\n");

// Third-party skills are upstream's text, which changes only with upgrades, so they are not checked
// (skills-lock.json).
const thirdPartySkills = new Set(
  Object.keys(JSON.parse(read("skills-lock.json")).skills),
);
const docs = [
  "AGENTS.md",
  "README.md",
  "GLOSSARY.md",
  ...globSync("docs/**/*.md", { cwd: projectRoot }),
  ...globSync(".claude/rules/**/*.md", { cwd: projectRoot }),
  ...globSync(".agents/skills/*/**/*.md", { cwd: projectRoot }).filter(
    (file) => !thirdPartySkills.has(file.split(/[\\/]/)[2]),
  ),
].map((file) => file.split("\\").join("/"));

/** Strips code blocks and inline code: the brackets and hashes in them are not links or headings. */
function prose(text) {
  return text.replace(/^(```|````)[\s\S]*?^\1/gm, "").replace(/`[^`\n]*`/g, "");
}

/** The anchors GitHub generates for headings: lowercase, punctuation removed, spaces turned into hyphens, and -1, -2 and so on added to repeats. */
function anchors(file) {
  const seen = new Map();
  const result = new Set();
  const text = read(file).replace(/^(```|````)[\s\S]*?^\1/gm, "");
  for (const [, heading] of text.matchAll(/^#{1,6} +(.+?) *#*$/gm)) {
    const base = heading
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/`/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    result.add(count === 0 ? base : `${base}-${count}`);
  }
  return result;
}

function brokenLinks(file, text = read(file)) {
  const broken = [];
  for (const [, target] of prose(text).matchAll(
    /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
  )) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const [path, anchor] = target.split("#");
    const resolved = path
      ? relative(projectRoot, join(projectRoot, dirname(file), path))
      : file;
    if (resolved.startsWith("node_modules")) continue;
    if (!existsSync(join(projectRoot, resolved))) {
      broken.push(target);
    } else if (
      anchor &&
      statSync(join(projectRoot, resolved)).isFile() &&
      !anchors(resolved).has(anchor)
    ) {
      broken.push(target);
    }
  }
  return broken;
}

describe("every relative link and anchor in the docs resolves", () => {
  test.each(docs)("%s", (file) => {
    expect(brokenLinks(file)).toStrictEqual([]);
  });
});

function missingDemoPaths(text) {
  const missing = [];
  for (const row of text.matchAll(/^\| \d+ \|.*$/gm)) {
    // The columns are #, Scenario, Rules, Code and Spec.
    const [, , , code, spec] = row[0].split(" | ");
    for (const [, path] of `${code} ${spec}`.matchAll(/`([^`]+)`/g)) {
      if (!path.includes("/")) continue;
      const full = /^(app|e2e)\//.test(path)
        ? path
        : `features/demo-task/${path}`;
      const found = path.includes("*")
        ? globSync(full, { cwd: projectRoot }).length > 0
        : existsSync(join(projectRoot, full));
      if (!found) missing.push(path);
    }
  }
  return missing;
}

test("the code and specs in the demos.md scenario table exist", () => {
  expect(
    missingDemoPaths(read(".agents/skills/next-data-flow/demos.md")),
  ).toStrictEqual([]);
});

test("the check itself finds broken links, anchors and paths", () => {
  expect(
    brokenLinks(
      ".claude/rules/example.md",
      "[a](e2e.md#hydration) [b](missing.md) [c](e2e.md#no-such-heading) `[d](missing.md)`",
    ),
  ).toStrictEqual(["missing.md", "e2e.md#no-such-heading"]);
  expect(
    missingDemoPaths(
      "| 1 | x | y | `api/get-task.ts`, `api/missing.ts`, `api/*-nothing.ts` | `e2e/demo/feed.spec.ts` |",
    ),
  ).toStrictEqual(["api/missing.ts", "api/*-nothing.ts"]);
});
