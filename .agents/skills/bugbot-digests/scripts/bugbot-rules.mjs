import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, matchesGlob, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Usage, from the project's root:
//   node .agents/skills/bugbot-digests/scripts/bugbot-rules.mjs          write the BUGBOT.md files
//   node .agents/skills/bugbot-digests/scripts/bugbot-rules.mjs --plan   list each rule's placement,
//                                                                         length, budget and hash
// Writes each rule's digest from .cursor/digests/ into the .cursor/BUGBOT.md that Cursor Bugbot
// reads, in each directory the rule's paths reach (the bugbot-digests skill). Bugbot reads the
// .cursor/BUGBOT.md of a changed file's directory and of every directory above it, so a rule sits
// where its paths point and stays out of changes elsewhere. Digests go in inline, not as links:
// Bugbot reads on through every file a link names, and rules in full exceed its limits.

export const RULES_DIR = ".claude/rules";
export const DIGESTS_DIR = ".cursor/digests";
const BUGBOT_FILE = ".cursor/BUGBOT.md";
// Every directory below features/ is a feature (docs/features.md, architecture/feature-graph), so a
// rule that would sit in features/ itself goes into each feature's directory instead.
const FEATURES_DIR = "features";

// Bugbot reads at most this many characters of one rule file, and of rules in one review
// (https://cursor.com/docs/bugbot). One change's load leaves room for the rules Bugbot learns and
// for a BUGBOT.md above the project, such as a monorepo's.
export const MAX_FILE_CHARS = 30_000;
export const MAX_LOAD_CHARS = 50_000;
// A digest's starting length, as a share of its rule's.
const DIGEST_SHARE = 0.35;
const MIN_DIGEST_CHARS = 600;

// A generated file is told by this start alone, so a reworded header still regenerates it.
const generatedMarker = "<!-- Generated";
const generatedHeader = `${generatedMarker} by the bugbot-digests skill's generator from ${RULES_DIR}/ and ${DIGESTS_DIR}/. Edit those, not this file. -->`;
const rootIntro = [
  "# Bugbot rules",
  "",
  "Review each change against the rules below and those in the `.cursor/BUGBOT.md` of the changed file's directory and every directory above it. Paths are relative to the project root, the directory holding this `.cursor/`. A rule covers only the files its `Applies to` line names. Name the rule each finding rests on.",
];

/** The nearest directory at or above `from` that holds a package.json: the project's root. */
export function findProjectRoot(from) {
  for (let directory = resolve(from); ; directory = dirname(directory)) {
    if (existsSync(join(directory, "package.json"))) return directory;
    if (dirname(directory) === directory)
      throw new Error(`no package.json at or above ${from}`);
  }
}

/** A project file's text with LF line endings, so output, hashes and sizes match on any checkout. */
export function readText(projectRoot, file) {
  return readFileSync(join(projectRoot, file), "utf8").replace(/\r\n/g, "\n");
}

/** The files git tracks or would add, as posix paths: ignored files, such as builds, place no rule. */
export function projectFiles(projectRoot) {
  const listing = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: projectRoot, encoding: "utf8" },
  );
  if (listing.status !== 0)
    throw new Error(`git ls-files failed in ${projectRoot}: ${listing.stderr}`);
  return listing.stdout
    .split("\0")
    .filter((file) => file && existsSync(join(projectRoot, file)));
}

/** Every rule under .claude/rules/, sorted. */
export function ruleFiles(projectRoot) {
  const rules = [];
  const walk = (directory) => {
    for (const entry of readdirSync(join(projectRoot, directory), {
      withFileTypes: true,
    })) {
      const path = posix.join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".md")) rules.push(path);
    }
  };
  walk(RULES_DIR);
  return rules.sort();
}

/** A rule's digest: the same relative path under .cursor/digests/. */
export function digestPath(rule) {
  return posix.join(DIGESTS_DIR, posix.relative(RULES_DIR, rule));
}

/** The sha256 of a rule's text, which its digest records to name the version it condenses. */
export function ruleHash(text) {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * A rule's `paths` globs. Only the block list Claude Code reads is accepted ("paths:" and then one
 * "  - <glob>" line per glob, the glob bare or quoted); any other form throws, since reading it as
 * no paths would quietly widen the rule to every change.
 */
export function rulePaths(rule, text) {
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1];
  if (frontmatter === undefined || !/^paths:/m.test(frontmatter)) return [];
  const block = /^paths:[ \t]*\n((?:[ \t]+-.*(?:\n|$))+)/m.exec(
    frontmatter,
  )?.[1];
  if (!block)
    throw new Error(
      `${rule}: write paths as a block list of "  - <glob>" lines`,
    );
  return block
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const entry =
        /^[ \t]+-[ \t]+(?:"([^"]+)"|'([^']+)'|([^\s#"']+))[ \t]*(?:#.*)?$/.exec(
          line,
        );
      if (!entry)
        throw new Error(`${rule}: cannot read the paths entry ${line.trim()}`);
      return entry[1] ?? entry[2] ?? entry[3];
    });
}

/**
 * The directories whose BUGBOT.md carries a rule. Each file a glob matches places the rule in the
 * file's directory, cut at the glob's first "**" so that one copy covers the subtree the glob
 * spans; a rule without `paths` goes to the project root. A directory is cut short of its first
 * dot-directory, since a BUGBOT.md there would sit among tool files, such as .claude/rules/, whose
 * every .md Claude Code loads as a rule, and features/ itself gives way to its features. A directory
 * below another of the same rule's is dropped, since Bugbot reads the BUGBOT.md files above a
 * changed file too.
 */
export function ruleDirectories(rule, globs, files) {
  if (globs.length === 0) return [""];
  const directories = new Set();
  for (const glob of globs) {
    const segments = glob.split("/");
    const spanStart = segments.indexOf("**");
    const depth = spanStart === -1 ? segments.length - 1 : spanStart;
    for (const file of files) {
      if (!matchesGlob(file, glob)) continue;
      const parts = file.split("/");
      let directory = parts.slice(0, Math.min(depth, parts.length - 1));
      const dot = directory.findIndex((part) => part.startsWith("."));
      if (dot !== -1) directory = directory.slice(0, dot);
      if (directory.join("/") === FEATURES_DIR && parts.length > 2)
        directory = parts.slice(0, 2);
      directories.add(directory.join("/"));
    }
  }
  if (directories.size === 0)
    throw new Error(
      `${rule}: its paths match no file, so Bugbot would never load it`,
    );
  return [...directories].filter(
    (directory) =>
      ![...directories].some(
        (other) =>
          other !== directory &&
          (other === "" || directory.startsWith(`${other}/`)),
      ),
  );
}

/**
 * A digest's `source`, `source-sha256` and body. A missing digest, or one naming another rule,
 * throws; a hash that no longer matches its rule is the caller's to report.
 */
export function readDigest(projectRoot, rule) {
  const file = digestPath(rule);
  if (!existsSync(join(projectRoot, file)))
    throw new Error(
      `${rule} has no digest: write ${file} as the project's Bugbot digest rule says`,
    );
  const text = readText(projectRoot, file);
  const match = /^---\n([\s\S]*?)\n---\n+([\s\S]*)$/.exec(text);
  const source = match && /^source:[ \t]*(\S+)[ \t]*$/m.exec(match[1])?.[1];
  const hash =
    match && /^source-sha256:[ \t]*([0-9a-f]{64})[ \t]*$/m.exec(match[1])?.[1];
  if (!match || source !== rule || !hash)
    throw new Error(
      `${file}: start it with frontmatter naming "source: ${rule}" and its "source-sha256"`,
    );
  return { file, hash, body: match[2].trimEnd() };
}

/** The digests written for an earlier version of their rule, each with the rule's hash now. */
export function staleDigests(projectRoot) {
  return ruleFiles(projectRoot).flatMap((rule) => {
    const current = ruleHash(readText(projectRoot, rule));
    const { file, hash } = readDigest(projectRoot, rule);
    return hash === current ? [] : [{ rule, file, hash: current }];
  });
}

/** Each rule's placement, length, starting digest budget and hash, to plan the digests by. */
export function plan(projectRoot) {
  const files = projectFiles(projectRoot);
  return ruleFiles(projectRoot).map((rule) => {
    const text = readText(projectRoot, rule);
    return {
      rule,
      digest: digestPath(rule),
      directories: ruleDirectories(rule, rulePaths(rule, text), files),
      length: text.length,
      budget: Math.max(
        MIN_DIGEST_CHARS,
        Math.round((text.length * DIGEST_SHARE) / 100) * 100,
      ),
      hash: ruleHash(text),
    };
  });
}

function section(projectRoot, rule, globs) {
  const text = readText(projectRoot, rule);
  const title = /^# +(.+)$/m.exec(text)?.[1] ?? rule;
  const appliesTo =
    globs.length === 0
      ? "every change"
      : globs.map((glob) => `\`${glob}\``).join(", ");
  return [
    `## ${title}`,
    `Applies to: ${appliesTo}.`,
    readDigest(projectRoot, rule).body,
  ].join("\n\n");
}

/** The BUGBOT.md files the rules call for, as path → content. */
export function expectedBugbotFiles(projectRoot) {
  const files = projectFiles(projectRoot);
  const sectionsByDirectory = new Map([["", []]]);
  for (const rule of ruleFiles(projectRoot)) {
    const globs = rulePaths(rule, readText(projectRoot, rule));
    const text = section(projectRoot, rule, globs);
    for (const directory of ruleDirectories(rule, globs, files)) {
      sectionsByDirectory.set(directory, [
        ...(sectionsByDirectory.get(directory) ?? []),
        text,
      ]);
    }
  }
  return Object.fromEntries(
    [...sectionsByDirectory]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([directory, sections]) => {
        const intro = directory
          ? [
              `# Bugbot rules: \`${directory}/\``,
              "",
              `For changes under \`${directory}/\`, beside the rules in the \`.cursor/BUGBOT.md\` files above it.`,
            ]
          : rootIntro;
        const content = [generatedHeader, intro.join("\n"), ...sections].join(
          "\n\n",
        );
        return [posix.join(directory, BUGBOT_FILE), `${content}\n`];
      }),
  );
}

/** The BUGBOT.md files in the project now, as path → content. */
export function currentBugbotFiles(projectRoot) {
  return Object.fromEntries(
    projectFiles(projectRoot)
      .filter(
        (file) => file === BUGBOT_FILE || file.endsWith(`/${BUGBOT_FILE}`),
      )
      .sort()
      .map((file) => [file, readText(projectRoot, file)]),
  );
}

/** The characters of rules a change to each project file loads, heaviest first. */
export function loads(projectRoot, expected = expectedBugbotFiles(projectRoot)) {
  const size = (directory) =>
    expected[posix.join(directory, BUGBOT_FILE)]?.length ?? 0;
  return projectFiles(projectRoot)
    .map((file) => {
      const parts = posix.dirname(file).split("/");
      let load = size("");
      for (let depth = 1; depth <= parts.length; depth++) {
        const directory = parts.slice(0, depth).join("/");
        if (directory !== ".") load += size(directory);
      }
      return { file, load };
    })
    .sort((left, right) => right.load - left.load);
}

/**
 * Writes the BUGBOT.md files the rules call for and removes the generated ones they no longer
 * call for. A BUGBOT.md written by hand throws instead: what it says belongs in a rule, where the
 * agent writing the code reads it too.
 */
export function generateBugbotFiles(projectRoot) {
  const expected = expectedBugbotFiles(projectRoot);
  const current = currentBugbotFiles(projectRoot);
  const handWritten = Object.keys(current).filter(
    (file) => !current[file].startsWith(generatedMarker),
  );
  if (handWritten.length > 0)
    throw new Error(
      `Not generated: ${handWritten.join(", ")}. Write what they say as a rule in ${RULES_DIR}/ with its digest.`,
    );
  for (const file of Object.keys(current)) {
    if (file in expected) continue;
    rmSync(join(projectRoot, file));
    const directory = join(projectRoot, posix.dirname(file));
    if (readdirSync(directory).length === 0) rmdirSync(directory);
  }
  for (const [file, content] of Object.entries(expected)) {
    mkdirSync(join(projectRoot, posix.dirname(file)), { recursive: true });
    writeFileSync(join(projectRoot, file), content, "utf8");
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const projectRoot = findProjectRoot(import.meta.dirname);
  if (process.argv.includes("--plan")) {
    for (const entry of plan(projectRoot))
      console.log(
        [
          entry.rule,
          `length ${entry.length}, budget ${entry.budget}`,
          `source-sha256: ${entry.hash}`,
          `goes to: ${entry.directories.map((directory) => directory || "(root)").join(", ")}`,
        ].join("\n  "),
      );
    process.exit(0);
  }
  const stale = staleDigests(projectRoot);
  if (stale.length > 0) {
    console.error(
      [
        "These rules changed since their digest was written. Bring each digest in line with its rule, set its source-sha256, and run the generator again:",
        ...stale.map(
          ({ rule, file, hash }) =>
            `- ${file} (${rule}): source-sha256: ${hash}`,
        ),
      ].join("\n"),
    );
    process.exit(1);
  }
  generateBugbotFiles(projectRoot);
  const [heaviest] = loads(projectRoot);
  console.log(
    `Wrote the BUGBOT.md files; the heaviest change (${heaviest.file}) loads ${heaviest.load} characters.`,
  );
}
