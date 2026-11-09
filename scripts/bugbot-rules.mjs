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
import { join, matchesGlob, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 用法：pnpm generate:bugbot
// 按 .claude/rules/ 里每条规则的 paths，把它在 .cursor/digests/ 里的摘要写进 Cursor Bugbot 读的
// .cursor/BUGBOT.md。Bugbot 读改动文件所在目录和它上面每一层目录的 .cursor/BUGBOT.md，所以一条规则放在它的
// paths 覆盖到的目录里，改动落在别处时就不加载。写的是摘要不是链接：Bugbot 会顺着链接继续读被链接文件里的链接，
// 规则全文加起来超过它的字数上限。

export const RULES_DIR = ".claude/rules";
export const DIGESTS_DIR = ".cursor/digests";
const BUGBOT_FILE = ".cursor/BUGBOT.md";

// Bugbot 对单个规则文件和一次 review 读到的规则总量都有字数上限（https://cursor.com/docs/bugbot）。
// 一次加载留出余量给 Bugbot 自己学到的规则和仓库根目录的 BUGBOT.md。
export const MAX_FILE_CHARS = 30_000;
export const MAX_LOAD_CHARS = 50_000;

// 生成的文件只认这个开头，改了说明文字也能认出来、重新生成。
const generatedMarker = "<!-- Generated";
const generatedHeader = `${generatedMarker} by pnpm generate:bugbot from ${RULES_DIR}/ and ${DIGESTS_DIR}/. Edit those, not this file. -->`;
const rootIntro = [
  "# Bugbot rules",
  "",
  "Review each change against the rules below and those in the `.cursor/BUGBOT.md` of the changed file's directory and every directory above it. Paths are relative to the project root, the directory holding this `.cursor/`. A rule covers only the files its `Applies to` line names. Name the rule each finding rests on.",
];

/** 读项目里的文件，换行统一成 LF：不管 git 用 LF 还是 CRLF 检出，生成结果、hash 和字数都一样。 */
export function readText(projectRoot, file) {
  return readFileSync(join(projectRoot, file), "utf8").replace(/\r\n/g, "\n");
}

/** git 跟踪或会加进来的项目文件（posix 路径）：被忽略的文件，比如 build 产物，不决定规则放在哪。 */
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

/** .claude/rules/ 下的每条规则，按路径排序。 */
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

/** 规则在 .cursor/digests/ 里的摘要：同样的相对路径。 */
export function digestPath(rule) {
  return posix.join(DIGESTS_DIR, posix.relative(RULES_DIR, rule));
}

/** 规则正文的 sha256，摘要用它记下自己是照着哪一版写的。 */
export function ruleHash(text) {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * 规则的 paths。只接受 Claude Code 读的块列表写法（"paths:" 下每行一个 "  - <glob>"，glob 可以带引号）；
 * 别的写法直接报错，因为当成没有 paths 会把规则悄悄放宽到每个改动。
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
 * 一条规则要放进哪些目录的 BUGBOT.md。glob 匹配到的每个文件把规则放在它所在的目录，截在 glob 第一个 "**" 处，
 * 一份就覆盖 glob 跨的整棵子树；没有 paths 的规则放在项目根。Bugbot 也读改动文件上面各层的 BUGBOT.md，所以
 * 同一条规则已经放在上层的目录就去掉。
 */
export function ruleDirectories(rule, globs, files) {
  if (globs.length === 0) return [""];
  const directories = new Set();
  for (const glob of globs) {
    const segments = glob.split("/");
    const spanStart = segments.indexOf("**");
    const depth = spanStart === -1 ? segments.length - 1 : spanStart;
    for (const file of files) {
      if (matchesGlob(file, glob))
        directories.add(file.split("/").slice(0, depth).join("/"));
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
 * 读一份摘要：frontmatter 里的 source 和 source-sha256，以及正文。缺文件、source 对不上，都直接报错；hash 对不上
 * 只记下来，由调用方决定报错还是提示。
 */
export function readDigest(projectRoot, rule) {
  const file = digestPath(rule);
  if (!existsSync(join(projectRoot, file)))
    throw new Error(
      `${rule} has no digest: write ${file} (see the skills-and-rules skill, Rules)`,
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

/** 摘要是照着旧版规则写的：规则改了，摘要还没跟上。每项给出摘要文件和规则现在的 hash。 */
export function staleDigests(projectRoot) {
  return ruleFiles(projectRoot).flatMap((rule) => {
    const current = ruleHash(readText(projectRoot, rule));
    const { file, hash } = readDigest(projectRoot, rule);
    return hash === current ? [] : [{ rule, file, hash: current }];
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
    "",
    `Applies to: ${appliesTo}.`,
    "",
    readDigest(projectRoot, rule).body,
  ].join("\n");
}

/** 规则要求的 BUGBOT.md 文件，路径 → 内容。 */
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
        const content = [generatedHeader, "", ...intro, "", ...sections].join(
          "\n\n",
        );
        return [
          posix.join(directory, BUGBOT_FILE),
          `${content.replace(/\n{3,}/g, "\n\n")}\n`,
        ];
      }),
  );
}

/** 项目里现有的 BUGBOT.md 文件，路径 → 内容。 */
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

/**
 * 写出规则要求的 BUGBOT.md，删掉不再需要的生成文件。手写的 BUGBOT.md 直接报错：它说的东西应该写成规则，
 * 让写代码的 agent 也读到。
 */
export function generateBugbotFiles(projectRoot) {
  const expected = expectedBugbotFiles(projectRoot);
  const current = currentBugbotFiles(projectRoot);
  const handWritten = Object.keys(current).filter(
    (file) => !current[file].startsWith(generatedMarker),
  );
  if (handWritten.length > 0)
    throw new Error(
      `Not generated: ${handWritten.join(", ")}. Write what they say as a rule in ${RULES_DIR}/ and its digest.`,
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
  const projectRoot = resolve(import.meta.dirname, "..");
  const stale = staleDigests(projectRoot);
  if (stale.length > 0) {
    console.error(
      [
        "These rules changed since their digest was written. Bring each digest in line with its rule, set its source-sha256, and run pnpm generate:bugbot again:",
        ...stale.map(
          ({ rule, file, hash }) =>
            `- ${file} (${rule}): source-sha256: ${hash}`,
        ),
      ].join("\n"),
    );
    process.exit(1);
  }
  generateBugbotFiles(projectRoot);
}
